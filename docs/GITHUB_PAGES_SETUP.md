# GitHub Pages Setup Guide

## 🚀 **Quick Setup for GitHub Pages**

Your repository has a GitHub Pages workflow, but GitHub Pages needs to be enabled in the repository settings.

### **Step 1: Enable GitHub Pages**

1. **Go to Repository Settings**:
   - Navigate to: https://github.com/dipseth/dataproc-mcp/settings
   - Click on **"Pages"** in the left sidebar

2. **Configure Source**:
   - **Source**: Select **"GitHub Actions"**
   - **Do NOT** select "Deploy from a branch"

3. **Save Settings**:
   - Click **"Save"** if prompted

### **Step 2: Verify Workflow Permissions**

1. **Go to Actions Settings**:
   - Navigate to: https://github.com/dipseth/dataproc-mcp/settings/actions
   - Click on **"General"** in the left sidebar

2. **Workflow Permissions**:
   - Select **"Read and write permissions"**
   - Check **"Allow GitHub Actions to create and approve pull requests"**
   - Click **"Save"**

### **Step 3: Trigger Deployment**

The workflow will automatically run when you push changes to the `main` branch that affect documentation files.

**Manual Trigger** (if needed):
1. Go to: https://github.com/dipseth/dataproc-mcp/actions
2. Click on **"Documentation"** workflow
3. Click **"Run workflow"** → **"Run workflow"**

### **Step 4: Access Your Documentation Site**

Once deployed, your documentation will be available at:
**https://dipseth.github.io/dataproc-mcp/**

## 🔧 **Workflow Details**

### **What the Workflow Does**:
1. **Generates Documentation**: Creates API docs, guides, and examples
2. **Validates Links**: Checks all documentation links
3. **Builds Site**: Creates a static site with navigation
4. **Deploys to Pages**: Publishes to GitHub Pages

### **Triggered By**:
- Pushes to `main` branch affecting:
  - `docs/**` files
  - `src/**/*.ts` files
  - `scripts/generate-docs.js`
  - `README.md`

### **Generated Content**:
- 📚 **API Reference**: Auto-generated from TypeScript code
- 🚀 **Quick Start Guide**: Installation and setup
- ⚙️ **Configuration Examples**: Real-world configurations
- 🔐 **Security Guide**: Authentication and best practices

## 🎯 **Expected Results**

After setup, you'll have:
- ✅ **Automated Documentation**: Updates with every code change
- ✅ **Professional Site**: Clean, navigable documentation
- ✅ **Link Validation**: Broken links caught automatically
- ✅ **Example Validation**: Configuration examples tested

## 🔍 **Troubleshooting**

### **Common Issues**:

1. **"Pages not found"**:
   - Ensure GitHub Pages is enabled with "GitHub Actions" source
   - Check workflow permissions are set to "Read and write"

2. **"Workflow failing"**:
   - Check the Actions tab for error details
   - Ensure all required npm scripts exist

3. **"Site not updating"**:
   - Workflow only runs on `main` branch
   - Check if your changes affect the trigger paths

### **Debug Steps**:
1. Check workflow status: https://github.com/dipseth/dataproc-mcp/actions
2. Verify Pages settings: https://github.com/dipseth/dataproc-mcp/settings/pages
3. Check workflow permissions: https://github.com/dipseth/dataproc-mcp/settings/actions

## ✅ **Verification**

After setup, verify everything works:
1. **Push a documentation change** to `main` branch
2. **Check Actions tab** for workflow execution
3. **Visit your Pages URL** to see the deployed site
4. **Test navigation** and links on the site

Your documentation site will be automatically maintained and updated! 🎉