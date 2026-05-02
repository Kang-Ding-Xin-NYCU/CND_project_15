const statusText = {
  pending_approval: "待簽核",
  approved: "已核准",
  rejected: "退回",
  received: "已收件",
  split: "已分貨",
  in_progress: "實驗中",
  completed: "已完成",
  closed: "已結案",
  queued: "待上貨",
  running: "執行中",
  idle: "閒置",
  busy: "使用中",
  maintenance: "保養",
  alarm: "異常"
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8"
};

module.exports = {
  statusText,
  contentTypes
};
