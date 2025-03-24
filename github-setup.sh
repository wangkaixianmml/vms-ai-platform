#!/bin/bash
# VMS AI Platform - GitHub设置脚本

# 设置你的GitHub用户名和仓库名
# 请在运行前修改这些值
GITHUB_USERNAME="wangkaixianmml"
REPO_NAME="vms-ai-platform"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印彩色信息
echo -e "${GREEN}开始初始化VMS AI Platform的Git仓库并上传至GitHub${NC}"

# 1. 初始化Git仓库
echo -e "${YELLOW}1. 初始化Git仓库${NC}"
git init

# 2. 添加.gitignore和LICENSE文件已经存在
echo -e "${YELLOW}2. 确认关键文件存在${NC}"
if [ ! -f .gitignore ]; then
    echo "错误: .gitignore文件不存在，请先创建"
    exit 1
fi
if [ ! -f LICENSE ]; then
    echo "错误: LICENSE文件不存在，请先创建"
    exit 1
fi

# 3. 添加所有文件到暂存区
echo -e "${YELLOW}3. 添加所有文件到Git${NC}"
git add .

# 4. 创建初始提交
echo -e "${YELLOW}4. 创建初始提交${NC}"
git commit -m "Initial commit: VMS AI Platform"

# 5. 创建main分支
echo -e "${YELLOW}5. 创建main分支${NC}"
git branch -M main

# 6. 添加GitHub远程仓库
echo -e "${YELLOW}6. 添加GitHub远程仓库${NC}"
git remote add origin https://github.com/$GITHUB_USERNAME/$REPO_NAME.git

# 7. 将代码推送到GitHub
echo -e "${YELLOW}7. 将代码推送到GitHub${NC}"
git push -u origin main

echo -e "${GREEN}完成! 代码已成功上传到GitHub仓库: https://github.com/$GITHUB_USERNAME/$REPO_NAME${NC}"
echo -e "${YELLOW}注意: 请确保你已经在GitHub上创建了仓库 '$REPO_NAME'${NC}" 