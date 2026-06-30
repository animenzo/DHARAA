import os

# Folder structure
folders = [
    "ai-service",
    "ai-service/routers",
    "ai-service/models"
]

files = {
    "ai-service/main.py": "",
    "ai-service/routers/chat.py": "",
    "ai-service/routers/crop.py": "",
    "ai-service/routers/disease.py": "",
    "ai-service/requirements.txt": "",
    "ai-service/.env": ""
}

# Create folders
for folder in folders:
    os.makedirs(folder, exist_ok=True)

# Create files
for file_path, content in files.items():
    with open(file_path, "w") as f:
        f.write(content)

print("✅ AI Service project structure created successfully!")