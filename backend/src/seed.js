const { hashPassword } = require("./auth");

function seedUser(id, username, name, role, department, site) {
  const passwordSalt = `seed-${username}`;
  return {
    id,
    username,
    name,
    role,
    department,
    site,
    passwordSalt,
    passwordHash: hashPassword("password123", passwordSalt)
  };
}

function createInitialState() {
  return {
    requestSeq: 4,
    recipeSeq: 4,
    jobSeq: 2,
    alarmSeq: 2,
    users: [
      seedUser("USR-001", "fab", "Ivy Chen", "fab", "Fab 12 R&D", "Fab 12"),
      seedUser("USR-002", "supervisor", "Sam Wang", "supervisor", "Central Lab", "Fab 12"),
      seedUser("USR-003", "operator", "Lab Operator", "operator", "Central Lab", "Fab 12"),
      seedUser("USR-004", "admin", "System Admin", "admin", "IT", "Global")
    ],
    requests: [
      {
        id: "REQ-2026-001",
        requester: "Evan Lin",
        department: "Fab 12 R&D",
        labType: "SEM",
        priority: "High",
        dueDate: "2026-05-08",
        goal: "Gate oxide defect review，需輸出 SEM 影像與缺陷摘要。",
        status: "pending_approval",
        samples: [
          { id: "SMP-001", material: "Wafer Lot A13", quantity: 3, status: "created" }
        ],
        wips: []
      },
      {
        id: "REQ-2026-002",
        requester: "Mia Huang",
        department: "Fab 15 Process",
        labType: "XRD",
        priority: "Normal",
        dueDate: "2026-05-10",
        goal: "薄膜晶向分析，需確認 stress trend。",
        status: "received",
        samples: [
          { id: "SMP-002", material: "Wafer Lot B07", quantity: 2, status: "received" }
        ],
        wips: [
          { id: "WIP-002-A", source: "SMP-002", quantity: 1, purpose: "XRD baseline", status: "queued" },
          { id: "WIP-002-B", source: "SMP-002", quantity: 1, purpose: "XRD confirm", status: "queued" }
        ]
      },
      {
        id: "REQ-2026-003",
        requester: "Nora Wu",
        department: "Fab 18 Yield",
        labType: "FTIR",
        priority: "Critical",
        dueDate: "2026-05-06",
        goal: "污染來源確認，需快速回傳光譜結果。",
        status: "in_progress",
        samples: [
          { id: "SMP-003", material: "Wafer Lot C21", quantity: 1, status: "loaded" }
        ],
        wips: [
          { id: "WIP-003-A", source: "SMP-003", quantity: 1, purpose: "FTIR urgent scan", status: "loaded" }
        ]
      }
    ],
    equipment: [
      { id: "EQ-SEM-01", name: "SEM-01", area: "Lab A", capability: "高解析影像", status: "idle", utilization: 62 },
      { id: "EQ-XRD-02", name: "XRD-02", area: "Lab B", capability: "薄膜晶體分析", status: "idle", utilization: 48 },
      { id: "EQ-FTIR-03", name: "FTIR-03", area: "Lab C", capability: "材料光譜", status: "busy", utilization: 81 },
      { id: "EQ-PROBE-04", name: "Probe-04", area: "Lab D", capability: "電性測試", status: "alarm", utilization: 35 }
    ],
    recipes: [
      { id: "RCP-001", equipmentId: "EQ-SEM-01", name: "Defect Review Standard", version: "1.2.0", parameters: "voltage=3kV; dwell=30ms", active: true },
      { id: "RCP-002", equipmentId: "EQ-XRD-02", name: "Thin Film Stress Scan", version: "2.1.0", parameters: "angle=20-80; step=0.02", active: true },
      { id: "RCP-003", equipmentId: "EQ-FTIR-03", name: "Contamination Quick Scan", version: "1.4.3", parameters: "range=400-4000; resolution=4", active: true }
    ],
    jobs: [
      {
        id: "JOB-2026-001",
        requestId: "REQ-2026-003",
        wipId: "WIP-003-A",
        equipmentId: "EQ-FTIR-03",
        recipeId: "RCP-003",
        operator: "Lab Operator",
        status: "running",
        note: "緊急件，優先處理。",
        history: [
          { action: "dispatch", actor: "Lab Operator", occurredAt: "2026-05-02 18:20", note: "派貨" },
          { action: "load", actor: "Lab Operator", occurredAt: "2026-05-02 18:32", note: "上貨" }
        ]
      }
    ],
    results: [],
    alarms: [
      { id: "ALM-001", equipmentId: "EQ-PROBE-04", severity: "High", message: "Probe card contact resistance over threshold", status: "alarm", createdAt: "2026-05-02 18:00" }
    ],
    audit: [
      { message: "REQ-2026-003 已派貨到 FTIR-03", actor: "Lab Operator", occurredAt: "2026-05-02 18:20" },
      { message: "REQ-2026-002 實驗室已收件", actor: "Lab Operator", occurredAt: "2026-05-02 17:50" },
      { message: "REQ-2026-001 送出主管簽核", actor: "Evan Lin", occurredAt: "2026-05-02 17:30" }
    ]
  };
}

module.exports = {
  createInitialState
};
