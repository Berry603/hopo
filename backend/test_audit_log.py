"""审计日志功能测试"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
resp = client.post('/api/v1/auth/login', json={'username':'admin','password':'admin123'})
token = resp.json()['data']['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 获取项目
resp = client.get('/api/v1/audit/projects', headers=headers)
pid = resp.json()['data'][0]['id']
print(f'Project: {pid[:8]}...')

# 创建任务 → 触发日志
resp = client.post('/api/v1/audit/tasks', headers=headers, json={
    'audit_project_id': pid, 'task_name': 'audit-log-test', 'task_type': 'test'
})
print(f'Create task: {resp.status_code} {resp.json().get("code")}')

# 阶段更新 → 触发日志
resp = client.put(f'/api/v1/audit/projects/{pid}/phases/00/progress', headers=headers, json={'status': 'completed'})
print(f'Phase update: {resp.status_code} {resp.json().get("data",{}).get("status","?")}')

# 查询日志
resp = client.get('/api/v1/audit/audit-logs', headers=headers)
data = resp.json()
logs = data.get('data', [])
print(f'\nAudit logs found: {data.get("total", 0)}')
for log in logs:
    print(f'  [{log["module"]}] {log["action"]} by {log["username"]}')
