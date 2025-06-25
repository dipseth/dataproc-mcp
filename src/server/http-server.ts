/**
 * Backwards Compatible HTTP Server implementation for MCP Dataproc Server
 * Supports both:
 * 1. Streamable HTTP transport (protocol version 2025-03-26)
 * 2. Deprecated HTTP+SSE transport (protocol version 2024-11-05)
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
// import { ProxyOAuthServerProvider as _ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
// import { mcpAuthRouter as _mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  getServerConfig /*, AuthenticationConfig as _AuthenticationConfig */,
} from '../config/server.js';
import { logger } from '../utils/logger.js';
import { JsonFileClientStore } from './auth/jsonFileClientStore.js';
import { EnhancedOAuthProvider } from './auth/enhancedOAuthProvider.js';
import { createCustomOAuthRouter } from './auth/customOAuthRouter.js';
import { GitHubOAuthProvider } from './auth/githubOAuthProvider.js';
import { createGitHubOAuthRouter } from './auth/githubOAuthRouter.js';
import { createOAuthMetadataRouter } from './auth/mcpOAuthMetadata.js';

/**
 * Custom WebSocket transport implementation for MCP
 */
class WebSocketServerTransport implements Transport {
  public sessionId: string;
  private ws: WebSocket;
  private isStarted = false;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage, extra?: { authInfo?: any }) => void;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.sessionId = randomUUID();

    // Set up WebSocket event handlers
    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as JSONRPCMessage;
        logger.debug(`WebSocket received message for session ${this.sessionId}:`, message);
        this.onmessage?.(message);
      } catch (error) {
        logger.error(`WebSocket message parsing error for session ${this.sessionId}:`, error);
        this.onerror?.(error as Error);
      }
    });

    this.ws.on('close', () => {
      logger.info(`WebSocket connection closed for session ${this.sessionId}`);
      this.onclose?.();
    });

    this.ws.on('error', (error: Error) => {
      logger.error(`WebSocket error for session ${this.sessionId}:`, error);
      this.onerror?.(error);
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;
    logger.info(`WebSocket transport started for session ${this.sessionId}`);
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not open for session ${this.sessionId}`);
    }

    try {
      const messageStr = JSON.stringify(message);
      logger.debug(`WebSocket sending message for session ${this.sessionId}:`, message);
      this.ws.send(messageStr);
    } catch (error) {
      logger.error(`WebSocket send error for session ${this.sessionId}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    logger.info(`WebSocket transport closed for session ${this.sessionId}`);
  }
}

export interface HttpServerOptions {
  port?: number;
  enableOAuthProxy?: boolean;
  mcpServer: McpServer;
  enableHttps?: boolean;
  httpsPort?: number;
}

export class DataprocHttpServer {
  private app: express.Application;
  private httpServer?: http.Server;
  private httpsServer?: https.Server;
  private httpWsServer?: WebSocketServer;
  private httpsWsServer?: WebSocketServer;
  private transports: Record<
    string,
    StreamableHTTPServerTransport | SSEServerTransport | WebSocketServerTransport
  > = {};
  private mcpServer: McpServer;
  private oauthProvider?: EnhancedOAuthProvider;
  private githubOAuthProvider?: GitHubOAuthProvider;
  private sessionStore = new Map<string, any>();

  constructor(private options: HttpServerOptions) {
    this.app = express();
    this.mcpServer = options.mcpServer;
    this.setupMiddleware();
  }

  /**
   * Load SSL certificates for HTTPS
   */
  private loadSSLCertificates(): { key: Buffer; cert: Buffer } | null {
    try {
      const projectRoot = path.resolve(process.cwd());
      const keyPath = path.join(projectRoot, 'certs', 'localhost-key.pem');
      const certPath = path.join(projectRoot, 'certs', 'localhost-cert.pem');

      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        logger.warn(
          'SSL certificates not found. Run "node scripts/generate-ssl-cert.js" to generate them.'
        );
        return null;
      }

      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);

      logger.info('SSL certificates loaded successfully');
      return { key, cert };
    } catch (error) {
      logger.error('Failed to load SSL certificates:', error);
      return null;
    }
  }

  /**
   * Get the base URL for the server (HTTP or HTTPS)
   */
  private getBaseUrl(useHttps: boolean = false): string {
    const protocol = useHttps ? 'https' : 'http';
    const port = useHttps ? this.options.httpsPort || 8443 : this.options.port || 8080;
    return `${protocol}://localhost:${port}`;
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Add request logging for debugging
    this.app.use((req, res, next) => {
      logger.debug(`Incoming Request: ${req.method} ${req.path}`);
      logger.debug(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
      if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        logger.warn(`Received WebSocket upgrade request for path: ${req.path}`);
      }
      next();
    });

    // Security and CORS headers
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;

      // Enhanced CORS for Claude.ai compatibility
      const allowedOrigins = [
        'https://claude.ai',
        'https://www.claude.ai',
        'https://app.claude.ai',
      ];

      let corsOrigin = '*';
      if (origin && allowedOrigins.includes(origin)) {
        corsOrigin = origin;
      } else if (origin) {
        corsOrigin = origin; // Allow other origins for development
      }

      // Add CORS headers
      res.header('Access-Control-Allow-Origin', corsOrigin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID, Sec-WebSocket-Protocol'
      );
      res.header('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });
  }

  private getServer(): McpServer {
    // Create a new server instance for each transport connection
    // This ensures proper isolation between different client connections
    return this.mcpServer;
  }

  private setupStreamableHttpRoutes(): void {
    // Handle all MCP requests (HTTP and WebSocket) on a unified endpoint
    this.app.all('/mcp', async (req: Request, res: Response) => {
      // Check if this is a WebSocket upgrade request
      if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        logger.debug('WebSocket upgrade request detected on /mcp endpoint');
        // Let the WebSocket server handle this - don't interfere
        return;
      }

      logger.debug(`Received ${req.method} request to /mcp (Streamable HTTP transport)`);

      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports[sessionId]) {
          // Check if the transport is of the correct type
          const existingTransport = this.transports[sessionId];
          if (existingTransport instanceof StreamableHTTPServerTransport) {
            // Reuse existing transport
            transport = existingTransport;
            logger.debug(`Reusing existing StreamableHTTP session: ${sessionId}`);
          } else {
            // Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)
            res.status(400).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Bad Request: Session exists but uses a different transport protocol',
              },
              id: null,
            });
            return;
          }
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // New initialization request
          logger.info('Creating new StreamableHTTP session');

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              // Store the transport by session ID when session is initialized
              logger.info(`StreamableHTTP session initialized with ID: ${sessionId}`);
              this.transports[sessionId] = transport;
            },
          });

          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports[sid]) {
              logger.info(
                `StreamableHTTP transport closed for session ${sid}, removing from transports map`
              );
              delete this.transports[sid];
            }
          };

          // Connect the transport to the MCP server
          const server = this.getServer();
          await server.connect(transport);
        } else {
          // Invalid request - no session ID or not initialization request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle the request with the transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error('Error handling MCP Streamable HTTP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });
  }

  private setupDeprecatedHttpSseRoutes(): void {
    // Deprecated HTTP+SSE transport (protocol version 2024-11-05)

    // GET /sse - Establish SSE stream
    this.app.get('/sse', async (req: Request, res: Response) => {
      logger.info('Received GET request to /sse (deprecated SSE transport)');

      try {
        logger.debug('Attempting to create new SSEServerTransport...');
        const transport = new SSEServerTransport('/messages', res);
        this.transports[transport.sessionId] = transport;
        logger.info(`SSEServerTransport created for session ${transport.sessionId}`);

        // Clean up on connection close
        res.on('close', () => {
          logger.info(`SSE transport connection closed for session ${transport.sessionId}`);
          delete this.transports[transport.sessionId];
        });

        const server = this.getServer();
        logger.debug(
          `Connecting MCP server to SSEServerTransport for session ${transport.sessionId}...`
        );
        await server.connect(transport);
        logger.info(
          `MCP server connected to SSEServerTransport for session ${transport.sessionId}`
        );
      } catch (error) {
        logger.error('Error handling SSE GET request:', error);
        if (!res.headersSent) {
          res.status(500).send('Internal server error');
        }
      }
    });

    // POST /messages - Handle messages for SSE transport
    this.app.post('/messages', async (req: Request, res: Response) => {
      logger.debug('Received POST request to /messages (deprecated SSE transport)');

      try {
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: sessionId query parameter required',
            },
            id: null,
          });
          return;
        }

        const existingTransport = this.transports[sessionId];

        if (!existingTransport) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No transport found for sessionId',
            },
            id: null,
          });
          return;
        }

        if (!(existingTransport instanceof SSEServerTransport)) {
          // Transport exists but is not a SSEServerTransport (could be StreamableHTTPServerTransport)
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol',
            },
            id: null,
          });
          return;
        }

        logger.debug(`Handling POST message for SSE session ${sessionId}...`);
        await existingTransport.handlePostMessage(req, res, req.body);
        logger.info(`POST message handled for SSE session ${sessionId}`);
      } catch (error) {
        logger.error('Error handling SSE POST message:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });
  }

  private async setupOAuthProxy(): Promise<void> {
    try {
      const serverConfig = await getServerConfig();
      const authConfig = serverConfig?.authentication;

      if (!authConfig?.useOAuthProxy) {
        logger.info('OAuth proxy disabled in configuration');
        return;
      }

      const oauthProvider = authConfig.oauthProvider || 'google';
      logger.info(`Setting up OAuth proxy with provider: ${oauthProvider}`);

      if (oauthProvider === 'github') {
        // Setup GitHub OAuth
        if (!authConfig.githubOAuth) {
          logger.warn('GitHub OAuth enabled but missing configuration');
          return;
        }

        logger.info('Setting up GitHub OAuth with config:', {
          clientId: authConfig.githubOAuth.clientId,
          redirectUri: authConfig.githubOAuth.redirectUri,
          scopes: authConfig.githubOAuth.scopes,
        });

        this.githubOAuthProvider = new GitHubOAuthProvider({
          clientId: authConfig.githubOAuth.clientId,
          clientSecret: authConfig.githubOAuth.clientSecret,
          redirectUri: authConfig.githubOAuth.redirectUri,
          scopes: authConfig.githubOAuth.scopes || ['read:user', 'user:email'],
        });

        const githubRouter = createGitHubOAuthRouter({
          provider: this.githubOAuthProvider,
          sessionStore: this.sessionStore,
          successRedirect: '/oauth/success',
          errorRedirect: '/oauth/error',
        });

        // Create OAuth metadata router for MCP Inspector discovery
        // Support both HTTP and HTTPS protocols based on requesting client
        const httpPort = this.options.port || 8080;
        const httpsPort = this.options.httpsPort || 8443;
        const metadataRouter = createOAuthMetadataRouter({
          baseUrl: this.getBaseUrl(false), // This is now just used as fallback
          clientId: authConfig.githubOAuth.clientId,
          clientSecret: authConfig.githubOAuth.clientSecret,
          httpPort: httpPort,
          httpsPort: httpsPort,
        });

        // Mount the OAuth metadata router first (for discovery endpoints)
        this.app.use('/', metadataRouter);

        // Mount the GitHub OAuth router
        this.app.use('/', githubRouter);

        // Add success and error pages
        this.app.get('/oauth/success', (req, res) => {
          const user = req.query.user;
          res.send(`
            <html>
              <head><title>GitHub OAuth Success</title></head>
              <body>
                <h1>✅ GitHub OAuth Successful!</h1>
                <p>Welcome, ${user}! You can now close this window.</p>
                <script>
                  setTimeout(() => window.close(), 3000);
                </script>
              </body>
            </html>
          `);
        });

        this.app.get('/oauth/error', (req, res) => {
          const error = req.query.error;
          res.send(`
            <html>
              <head><title>GitHub OAuth Error</title></head>
              <body>
                <h1>❌ GitHub OAuth Error</h1>
                <p>Error: ${error}</p>
                <p>Please try again or contact support.</p>
              </body>
            </html>
          `);
        });

        logger.info('GitHub OAuth setup completed successfully');
      } else {
        // Setup Google OAuth (existing logic)
        if (!authConfig.oauthProxyEndpoints || !authConfig.oauthProxyClientId) {
          logger.warn('Google OAuth enabled but missing required configuration');
          return;
        }

        logger.info('Setting up Google OAuth with endpoints:', authConfig.oauthProxyEndpoints);

        // Create client store for dynamic client registration
        const clientStore = new JsonFileClientStore();
        logger.info('Initialized JsonFileClientStore for dynamic client registration');

        // Create enhanced OAuth provider with dynamic client registration support
        this.oauthProvider = new EnhancedOAuthProvider({
          endpoints: {
            authorizationUrl: authConfig.oauthProxyEndpoints.authorizationUrl,
            tokenUrl: authConfig.oauthProxyEndpoints.tokenUrl,
            revocationUrl: authConfig.oauthProxyEndpoints.revocationUrl,
          },
          clientStore: clientStore,
          fallbackClientId: authConfig.oauthProxyClientId,
          fallbackClientSecret: authConfig.oauthProxyClientSecret,
          fallbackRedirectUris: authConfig.oauthProxyRedirectUris,
        });

        // Set up custom OAuth router with dynamic client registration
        // Support both HTTP and HTTPS protocols based on requesting client
        const baseUrl = new URL(this.getBaseUrl(false)); // Use HTTP as default, will be protocol-aware
        const issuerUrl = new URL(authConfig.oauthProxyEndpoints.authorizationUrl).origin;

        const oauthRouter = createCustomOAuthRouter({
          provider: this.oauthProvider,
          issuerUrl: new URL(issuerUrl),
          baseUrl: baseUrl,
          serviceDocumentationUrl: new URL('https://github.com/dipseth/dataproc-mcp'),
        });

        // Mount the OAuth router
        this.app.use('/', oauthRouter);

        logger.info(
          'Google OAuth proxy setup completed successfully with dynamic client registration and device flow support'
        );
      }
    } catch (error) {
      logger.error('Failed to setup OAuth proxy:', error);
      throw error;
    }
  }

  private setupWebSocketServers(): void {
    // Setup HTTP WebSocket server with MCP subprotocol support
    if (this.httpServer) {
      this.httpWsServer = new WebSocketServer({
        server: this.httpServer,
        path: '/mcp',
        // Handle subprotocol negotiation for Claude.ai compatibility
        handleProtocols: (protocols: Set<string>) => {
          logger.debug(`WebSocket subprotocols requested: ${Array.from(protocols).join(', ')}`);
          // Claude.ai expects 'mcp' subprotocol support
          if (protocols.has('mcp')) {
            logger.info('MCP subprotocol negotiated successfully');
            return 'mcp';
          }
          // Allow connection without subprotocol for backward compatibility
          logger.debug('No MCP subprotocol requested, allowing connection');
          return false;
        },
      });

      this.httpWsServer.on('connection', (ws: WebSocket, request) => {
        logger.info(
          `WebSocket connection established on HTTP server from ${request.socket.remoteAddress}`
        );
        logger.debug(`WebSocket protocol negotiated: ${ws.protocol}`);
        this.handleWebSocketConnection(ws, request);
      });

      logger.info(
        'HTTP WebSocket server configured at ws://localhost:*/mcp with MCP subprotocol support'
      );
    }

    // Setup HTTPS WebSocket server with MCP subprotocol support
    if (this.httpsServer) {
      this.httpsWsServer = new WebSocketServer({
        server: this.httpsServer,
        path: '/mcp',
        // Handle subprotocol negotiation for Claude.ai compatibility
        handleProtocols: (protocols: Set<string>) => {
          logger.debug(`WebSocket subprotocols requested: ${Array.from(protocols).join(', ')}`);
          // Claude.ai expects 'mcp' subprotocol support
          if (protocols.has('mcp')) {
            logger.info('MCP subprotocol negotiated successfully');
            return 'mcp';
          }
          // Allow connection without subprotocol for backward compatibility
          logger.debug('No MCP subprotocol requested, allowing connection');
          return false;
        },
      });

      this.httpsWsServer.on('connection', (ws: WebSocket, request) => {
        logger.info(
          `WebSocket connection established on HTTPS server from ${request.socket.remoteAddress}`
        );
        logger.debug(`WebSocket protocol negotiated: ${ws.protocol}`);
        this.handleWebSocketConnection(ws, request);
      });

      logger.info(
        'HTTPS WebSocket server configured at wss://localhost:*/mcp with MCP subprotocol support'
      );
    }
  }

  private handleWebSocketConnection(ws: WebSocket, _request: http.IncomingMessage): void {
    try {
      // Validate MCP subprotocol for Claude.ai compatibility
      if (ws.protocol !== 'mcp') {
        logger.warn(
          `WebSocket connection attempted without MCP subprotocol. Protocol: ${ws.protocol}`
        );
        // Still allow connection for backward compatibility, but log the warning
      } else {
        logger.info(`WebSocket connection established with MCP subprotocol`);
      }

      // Create WebSocket transport
      const transport = new WebSocketServerTransport(ws);

      // Store the transport
      this.transports[transport.sessionId] = transport;
      logger.info(`WebSocket transport created for session ${transport.sessionId}`);

      // Set up cleanup on connection close
      transport.onclose = () => {
        logger.info(
          `WebSocket transport closed for session ${transport.sessionId}, removing from transports map`
        );
        delete this.transports[transport.sessionId];
      };

      // Connect the transport to the MCP server
      const server = this.getServer();
      server
        .connect(transport)
        .then(() => {
          logger.info(
            `MCP server connected to WebSocket transport for session ${transport.sessionId}`
          );
        })
        .catch((error) => {
          logger.error(
            `Failed to connect MCP server to WebSocket transport for session ${transport.sessionId}:`,
            error
          );
          transport.close();
        });
    } catch (error) {
      logger.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private setupHealthCheck(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        sessions: Object.keys(this.transports).length,
        transports: {
          streamableHttp: Object.values(this.transports).filter(
            (t) => t instanceof StreamableHTTPServerTransport
          ).length,
          sse: Object.values(this.transports).filter((t) => t instanceof SSEServerTransport).length,
          websocket: Object.values(this.transports).filter(
            (t) => t instanceof WebSocketServerTransport
          ).length,
        },
        oauthEnabled: !!this.oauthProvider,
        supportedProtocols: [
          '2025-03-26', // Streamable HTTP
          '2024-11-05', // HTTP+SSE
          'websocket', // WebSocket
        ],
      });
    });
  }

  public async start(): Promise<void> {
    try {
      // Setup OAuth proxy if enabled
      if (this.options.enableOAuthProxy) {
        await this.setupOAuthProxy();
      }

      // Setup both transport routes
      this.setupStreamableHttpRoutes();
      this.setupDeprecatedHttpSseRoutes();

      // Setup health check and info endpoints
      this.setupHealthCheck();

      const httpPort = this.options.port || 8080;
      const httpsPort = this.options.httpsPort || 8443;
      const enableHttps = this.options.enableHttps !== false; // Default to true

      const promises: Promise<void>[] = [];

      // Start HTTP server (for backward compatibility and non-OAuth endpoints)
      promises.push(
        new Promise((resolve, reject) => {
          this.httpServer = this.app.listen(httpPort, () => {
            logger.info(`🚀 HTTP MCP Server started on port ${httpPort}`);
            resolve();
          });

          this.httpServer?.on('error', (error: any) => {
            logger.error('HTTP server error:', error);
            reject(error);
          });
        })
      );

      // Start HTTPS server if enabled (required for OAuth endpoints)
      if (enableHttps) {
        const sslOptions = this.loadSSLCertificates();
        if (sslOptions) {
          promises.push(
            new Promise((resolve, reject) => {
              this.httpsServer = https.createServer(sslOptions, this.app);
              this.httpsServer.listen(httpsPort, () => {
                logger.info(`🔐 HTTPS MCP Server started on port ${httpsPort}`);
                resolve();
              });

              this.httpsServer.on('error', (error: any) => {
                logger.error('HTTPS server error:', error);
                reject(error);
              });
            })
          );
        } else {
          logger.warn(
            'HTTPS requested but SSL certificates not available. OAuth endpoints may not work with Claude Desktop.'
          );
        }
      }

      await Promise.all(promises);

      // Setup WebSocket servers after HTTP/HTTPS servers are started
      this.setupWebSocketServers();

      logger.info(`
==============================================
SUPPORTED TRANSPORT OPTIONS:

1. Streamable HTTP (Protocol version: 2025-03-26)
   HTTP Endpoint:  http://localhost:${httpPort}/mcp
   HTTPS Endpoint: https://localhost:${httpsPort}/mcp
   Methods: GET, POST, DELETE

2. HTTP + SSE (Protocol version: 2024-11-05)
   HTTP Endpoints:  /sse (GET) and /messages (POST)
   HTTPS Endpoints: /sse (GET) and /messages (POST)

3. WebSocket (Real-time bidirectional communication)
   HTTP WebSocket:  ws://localhost:${httpPort}/mcp
   HTTPS WebSocket: wss://localhost:${httpsPort}/mcp
   ✅ Compatible with Claude.ai web app (MCP subprotocol support)
   ✅ Unified endpoint: /mcp handles both HTTP and WebSocket

4. OAuth Authorization (Protocol-aware endpoints):
   HTTP Authorization Server:  http://localhost:${httpPort}/.well-known/oauth-authorization-server
   HTTPS Authorization Server: https://localhost:${httpsPort}/.well-known/oauth-authorization-server
   HTTP Authorization:          http://localhost:${httpPort}/auth/github
   HTTPS Authorization:         https://localhost:${httpsPort}/auth/github
   HTTP Token:                  http://localhost:${httpPort}/auth/github/token
   HTTPS Token:                 https://localhost:${httpsPort}/auth/github/token
   HTTP Registration:           http://localhost:${httpPort}/oauth/register
   HTTPS Registration:          https://localhost:${httpsPort}/oauth/register

5. Health & Info:
   HTTP:  http://localhost:${httpPort}/health
   HTTPS: https://localhost:${httpsPort}/health

⚠️  Note: OAuth endpoints are now protocol-aware:
   - HTTP endpoints work with MCP Inspector and development tools
   - HTTPS endpoints work with Claude Desktop and production clients
   - Metadata discovery returns URLs matching the requesting protocol
==============================================`);
    } catch (error) {
      logger.error('Failed to start servers:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    // Close all active transports to properly clean up resources
    for (const sessionId in this.transports) {
      try {
        logger.info(`Closing transport for session ${sessionId}`);
        this.transports[sessionId].close();
        delete this.transports[sessionId];
      } catch (error) {
        logger.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }

    const promises: Promise<void>[] = [];

    // Close WebSocket servers
    if (this.httpWsServer) {
      promises.push(
        new Promise((resolve) => {
          this.httpWsServer!.close(() => {
            logger.info('HTTP WebSocket server stopped');
            resolve();
          });
        })
      );
    }

    if (this.httpsWsServer) {
      promises.push(
        new Promise((resolve) => {
          this.httpsWsServer!.close(() => {
            logger.info('HTTPS WebSocket server stopped');
            resolve();
          });
        })
      );
    }

    // Close HTTP server
    if (this.httpServer) {
      promises.push(
        new Promise((resolve) => {
          this.httpServer!.close(() => {
            logger.info('HTTP server stopped');
            resolve();
          });
        })
      );
    }

    // Close HTTPS server
    if (this.httpsServer) {
      promises.push(
        new Promise((resolve) => {
          this.httpsServer!.close(() => {
            logger.info('HTTPS server stopped');
            resolve();
          });
        })
      );
    }

    await Promise.all(promises);
    logger.info('All servers stopped');
  }

  public getSessionCount(): number {
    return Object.keys(this.transports).length;
  }

  public getTransportStats(): { streamableHttp: number; sse: number; websocket: number } {
    return {
      streamableHttp: Object.values(this.transports).filter(
        (t) => t instanceof StreamableHTTPServerTransport
      ).length,
      sse: Object.values(this.transports).filter((t) => t instanceof SSEServerTransport).length,
      websocket: Object.values(this.transports).filter((t) => t instanceof WebSocketServerTransport)
        .length,
    };
  }
}
