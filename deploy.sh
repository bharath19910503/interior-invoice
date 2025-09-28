#!/bin/bash

# Make sure you are in the root folder of your project
# Example: cd ~/VarshithInterior

# Step 1: Remove old Git history (if you want a clean repo)
rm -rf .git

# Step 2: Initialize new Git repository
git init

# Step 3: Add all files
git add .

# Step 4: Commit changes
git commit -m "Deploy new VarshithInterior project"

# Step 5: Add remote GitHub repository
# Replace the URL below with your GitHub repository URL
git remote add origin https://github.com/bharath19910503/InvoiceVIS

# Step 6: Push to GitHub (force overwrite to remove old code)
git branch -M main
git push -u origin main --force

echo "Deployment completed successfully!"
