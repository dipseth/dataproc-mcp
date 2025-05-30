# CI/CD Workflow Patterns & Common Issues

## 🔄 **Frequent Pull/Rebase Pattern**

### **Why This Happens**
When using semantic-release with automated versioning, you'll frequently encounter this pattern:

```bash
git push origin main
# ❌ Error: Updates were rejected (fetch first)

git pull --rebase
# ✅ Success: Pulls semantic-release commits/tags

git push origin main
# ✅ Success: Now pushes your changes
```

### **Root Cause**
- **Semantic-release** automatically creates commits and tags on successful CI runs
- Your local branch becomes "behind" the remote after each CI/CD run
- This is **normal behavior** with automated release workflows

### **Solutions**

#### **Option 1: Always Pull Before Push (Recommended)**
```bash
# Before making changes
git pull --rebase

# Make your changes, commit
git add .
git commit -m "feat: your changes"

# Pull again before push (in case CI ran while you worked)
git pull --rebase
git push origin main
```

#### **Option 2: Configure Git Auto-rebase**
```bash
# Set up automatic rebase for pulls
git config pull.rebase true
git config rebase.autoStash true

# Now git pull will automatically rebase
git pull  # equivalent to git pull --rebase
```

#### **Option 3: Use Force Push (⚠️ Dangerous)**
```bash
# Only use if you're sure no one else is working on main
git push --force-with-lease origin main
```

### **Best Practices**

1. **Always run `npm run pre-push`** before any git operations
2. **Pull before starting work** on a new feature
3. **Pull before pushing** to catch any CI updates
4. **Use `--rebase`** to maintain clean history
5. **Monitor CI/CD runs** to understand when semantic-release creates commits

### **Automation Tip**
Add this alias to your `.gitconfig`:
```bash
git config alias.sync "!git pull --rebase && git push"
```

Then use: `git sync` instead of separate pull/push commands.

## 🚀 **Semantic-Release Workflow**

### **Normal Flow**
1. Developer commits with conventional commit message
2. CI/CD runs tests, builds, and semantic-release
3. Semantic-release creates new version commit + tag
4. NPM package published automatically
5. Developer needs to pull these automated commits

### **Expected Behavior**
- **v1.0.0** → **v1.0.1** (patch for fixes)
- **v1.0.1** → **v1.1.0** (minor for features)  
- **v1.1.0** → **v2.0.0** (major for breaking changes)

This pattern is **by design** and indicates a healthy CI/CD pipeline! 🎉