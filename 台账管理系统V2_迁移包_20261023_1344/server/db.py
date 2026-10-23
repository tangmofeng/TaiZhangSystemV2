# -*- coding: utf-8 -*-
"""数据库初始化、建表、导入初始数据"""
import os
import json
import sqlite3
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.path.join(DATA_DIR, 'system.db')
BACKUP_DIR = os.path.join(DATA_DIR, 'backup')
CLEAN_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_import', 'clean_data.json')

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  real_name TEXT,
  role TEXT DEFAULT 'admin',
  active INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS printers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_no TEXT,
  department TEXT,
  contact TEXT,
  location TEXT,
  model TEXT,
  ip TEXT,
  remark TEXT,
  status TEXT DEFAULT '在用',
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS consumables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT,
  category TEXT,
  material_code TEXT,
  stock REAL DEFAULT 0,
  low_threshold REAL DEFAULT 0,
  remark TEXT,
  price REAL DEFAULT 0,
  printer_models TEXT
);

CREATE TABLE IF NOT EXISTS consumable_stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumable_id INTEGER NOT NULL,
  region TEXT DEFAULT '办公楼',
  storage TEXT DEFAULT '',
  stock REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS consumable_stock_in (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_in_time TEXT,
  consumable_id INTEGER,
  model TEXT,
  category TEXT,
  qty REAL,
  price REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  operator TEXT,
  note TEXT,
  created_at TEXT,
  region TEXT DEFAULT '',
  storage TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS consumable_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oa_no TEXT,
  location TEXT,
  model TEXT,
  consumable TEXT,
  qty REAL DEFAULT 1,
  department TEXT,
  applicant TEXT,
  operator TEXT,
  issue_time TEXT,
  created_at TEXT,
  price REAL DEFAULT 0,
  consumable_id INTEGER,
  region TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS printer_repairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER,
  fault_desc TEXT,
  report_time TEXT,
  reported_by TEXT,
  repair_result TEXT,
  repair_time TEXT,
  repair_company TEXT,
  cost REAL DEFAULT 0,
  status TEXT DEFAULT '待维修',
  remark TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS spare_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT,
  name TEXT,
  spec TEXT,
  unit TEXT,
  remark TEXT
);

CREATE TABLE IF NOT EXISTS spare_stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  region TEXT,
  warehouse TEXT,
  location TEXT,
  qty REAL DEFAULT 0,
  owner TEXT,
  remark TEXT,
  low_threshold REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS spare_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  item_id INTEGER,
  brand TEXT,
  name TEXT,
  spec TEXT,
  unit TEXT,
  qty REAL,
  region TEXT,
  warehouse TEXT,
  location TEXT,
  applicant TEXT,
  reviewer TEXT,
  operator TEXT,
  record_time TEXT,
  remark TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS computers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_no TEXT,
  hostname TEXT,
  brand TEXT,
  model TEXT,
  sn TEXT,
  config TEXT,
  user_name TEXT,
  department TEXT,
  location TEXT,
  ip TEXT,
  mac TEXT,
  purchase_date TEXT,
  warranty_until TEXT,
  status TEXT DEFAULT '在用',
  remark TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS computer_repairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  computer_id INTEGER,
  type TEXT,
  detail TEXT,
  record_time TEXT,
  operator TEXT,
  cost REAL DEFAULT 0,
  remark TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS pc_upgrades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant TEXT,
  flow_no TEXT,
  asset_no TEXT,
  ram_8 INTEGER DEFAULT 0,
  ram_16 INTEGER DEFAULT 0,
  sata_ssd INTEGER DEFAULT 0,
  m2_ssd INTEGER DEFAULT 0,
  hdd INTEGER DEFAULT 0,
  upgrade_date TEXT,
  remark TEXT,
  part_name TEXT,
  part_stock INTEGER,
  zk INTEGER DEFAULT 0,
  bg INTEGER DEFAULT 0,
  purchase_date TEXT,
  part_id INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS pc_upgrade_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upgrade_id INTEGER,
  part_id INTEGER,
  brand TEXT,
  name TEXT,
  spec TEXT,
  qty INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS pc_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT,
  name TEXT,
  spec TEXT,
  unit TEXT DEFAULT '个',
  stock INTEGER DEFAULT 0,
  low_threshold INTEGER DEFAULT 0,
  remark TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS pc_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  part_id INTEGER,
  part_name TEXT,
  qty INTEGER,
  operator TEXT,
  ref TEXT,
  record_time TEXT,
  remark TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS pc_adjusts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  part_id INTEGER,
  part_name TEXT,
  qty INTEGER,
  reason TEXT,
  operator TEXT,
  adjust_time TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sys_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT,
  user TEXT,
  action TEXT,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT,
  file TEXT,
  size INTEGER,
  result TEXT
);

CREATE TABLE IF NOT EXISTS price_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  long_desc TEXT,
  name TEXT,
  mat_desc TEXT,
  price REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER,
  month INTEGER,
  amount REAL DEFAULT 0,
  remark TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(year, month)
);

CREATE TABLE IF NOT EXISTS consumable_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  maintain_time TEXT,
  model TEXT,
  category TEXT,
  content TEXT,
  cost REAL DEFAULT 0,
  maintainer TEXT,
  remark TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS stocktakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no TEXT,
  take_time TEXT,
  operator TEXT,
  warehouse TEXT,
  status TEXT DEFAULT '进行中',
  remark TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS stocktake_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER,
  stock_id INTEGER,
  item_id INTEGER,
  brand TEXT,
  name TEXT,
  spec TEXT,
  unit TEXT,
  warehouse TEXT,
  location TEXT,
  book_qty REAL DEFAULT 0,
  actual_qty REAL,
  diff_qty REAL DEFAULT 0,
  status TEXT DEFAULT '待调整'
);


CREATE TABLE IF NOT EXISTS spare_adjusts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  item_id INTEGER,
  brand TEXT,
  name TEXT,
  spec TEXT,
  unit TEXT,
  warehouse TEXT,
  location TEXT,
  qty REAL,
  reason TEXT,
  operator TEXT,
  adjust_time TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS consumable_adjusts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumable_id INTEGER,
  model TEXT,
  category TEXT,
  type TEXT DEFAULT '手工调整',
  delta REAL DEFAULT 0,
  before_stock REAL DEFAULT 0,
  after_stock REAL DEFAULT 0,
  reason TEXT,
  operator TEXT,
  adjust_time TEXT,
  created_at TEXT,
  region TEXT DEFAULT '',
  storage TEXT DEFAULT ''
);


CREATE TABLE IF NOT EXISTS ai_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  summary TEXT,
  requester TEXT,
  raw_text TEXT,
  operator TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  tags TEXT,
  creator TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_settings (
  k TEXT PRIMARY KEY,
  v TEXT
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  detail TEXT,
  status TEXT DEFAULT '待处理',
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id INTEGER,
  role TEXT,
  content TEXT,
  attachments TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS pc_replace (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name TEXT,
  department TEXT,
  location TEXT,
  part_name TEXT,
  replaced TEXT DEFAULT '是',
  returned TEXT DEFAULT '否',
  monitor_sn TEXT,
  part_qty TEXT,
  storage TEXT,
  remark TEXT,
  record_time TEXT,
  operator TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pc_monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area TEXT,
  department TEXT,
  location TEXT,
  monitor_count INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pc_hall_computers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area TEXT,
  department TEXT,
  location TEXT,
  ip TEXT,
  user_name TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pc_part_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT DEFAULT '',
  unit TEXT DEFAULT '个',
  stock INTEGER DEFAULT 0,
  low_threshold INTEGER DEFAULT 0,
  storage_location TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pc_part_stock_in (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_name TEXT NOT NULL,
  spec TEXT DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  after_stock INTEGER DEFAULT 0,
  storage_location TEXT DEFAULT '',
  operator TEXT DEFAULT '',
  record_time TEXT DEFAULT (datetime('now','localtime')),
  remark TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

/* 用户级个性化设置（列顺序/列显隐等）：按 username 隔离，同一账号跨电脑同步 */
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  skey TEXT NOT NULL,
  sval TEXT,
  updated_at TEXT,
  UNIQUE(username, skey)
);

/* 全局列配置（列顺序/列显隐）：所有用户共享一份，admin 保存后全员同步 */
CREATE TABLE IF NOT EXISTS col_settings (
  id TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT
);


"""


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    conn = get_conn()
    conn.executescript(SCHEMA)
    # 迁移：pc_upgrades 增加 part_id 列（关联电脑优化备件库存）
    cols = [r[1] for r in conn.execute('PRAGMA table_info(pc_upgrades)').fetchall()]
    if 'part_id' not in cols:
        conn.execute('ALTER TABLE pc_upgrades ADD COLUMN part_id INTEGER')
    conn.commit()
    conn.close()

def num(v):
    try:
        if v is None or str(v).strip() == '':
            return 0
        return float(v)
    except (ValueError, TypeError):
        return 0


def import_data(clean_path):
    """导入清洗后的 JSON 数据；幂等：表已有数据则跳过"""
    conn = get_conn()
    cnt = conn.execute("SELECT COUNT(*) FROM printers").fetchone()[0]
    if cnt > 0:
        conn.close()
        print("数据已存在（printers=%d），跳过导入" % cnt)
        return False

    with open(clean_path, encoding='utf-8') as f:
        d = json.load(f)
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # 打印机
    for p in d.get('printers', []):
        conn.execute(
            "INSERT INTO printers(printer_no,department,contact,location,model,ip,remark,status,created_at) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            (p.get('printer_no', ''), p.get('department', ''), p.get('contact', ''),
             p.get('location', ''), p.get('model', ''), p.get('ip', ''),
             p.get('remark', ''), p.get('status', '在用'), now))

    # 耗材
    for c in d.get('consumables', []):
        conn.execute(
            "INSERT INTO consumables(model,category,material_code,stock,low_threshold,remark) "
            "VALUES(?,?,?,?,0,'')",
            (c.get('model', ''), c.get('category', ''), c.get('material_code', ''), num(c.get('stock'))))

    # 发放记录
    for r in d.get('issues', []):
        conn.execute(
            "INSERT INTO consumable_issues(oa_no,location,model,consumable,qty,department,applicant,operator,issue_time,created_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?)",
            (r.get('oa_no', ''), r.get('location', ''), r.get('model', ''),
             r.get('consumable', ''), num(r.get('qty')), r.get('department', ''),
             r.get('applicant', ''), r.get('operator', ''), r.get('issue_time', ''), now))

    # 备件物资 + 库存
    item_map = {}
    for it in d.get('spare_items', []):
        cur = conn.execute(
            "INSERT INTO spare_items(brand,name,spec,unit,remark) VALUES(?,?,?,?,?)",
            (it.get('brand', ''), it.get('name', ''), it.get('spec', ''),
             it.get('unit', ''), it.get('remark', '')))
        item_map[(it.get('brand', ''), it.get('name', ''), it.get('spec', ''), it.get('unit', ''))] = cur.lastrowid
    for s in d.get('spare_stocks', []):
        conn.execute(
            "INSERT INTO spare_stocks(item_id,region,warehouse,location,qty,owner,remark,low_threshold) "
            "VALUES(?,?,?,?,?,?,?,0)",
            (s.get('item_id'), s.get('region', ''), s.get('warehouse', ''),
             s.get('location', ''), num(s.get('qty')), s.get('owner', ''), s.get('remark', '')))

    # 出入库流水（历史）
    def find_item(brand, name, spec, unit):
        key = (brand or '', name or '', spec or '', unit or '')
        if key in item_map:
            return item_map[key]
        cur = conn.execute(
            "INSERT INTO spare_items(brand,name,spec,unit,remark) VALUES(?,?,?,?,'历史流水')",
            (brand or '', name or '', spec or '', unit or ''))
        iid = cur.lastrowid
        item_map[key] = iid
        return iid

    for r in d.get('spare_flows_in', []) + d.get('spare_flows_out', []):
        iid = find_item(r.get('brand', ''), r.get('name', ''), r.get('spec', ''), r.get('unit', ''))
        conn.execute(
            "INSERT INTO spare_flows(type,item_id,brand,name,spec,unit,qty,region,warehouse,location,"
            "applicant,reviewer,operator,record_time,remark,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (r.get('type', 'in'), iid, r.get('brand', ''), r.get('name', ''), r.get('spec', ''),
             r.get('unit', ''), num(r.get('qty')), r.get('region', ''), r.get('warehouse', ''),
             r.get('location', ''), r.get('applicant', ''), r.get('reviewer', ''),
             r.get('operator', ''), r.get('record_time', ''), r.get('remark', ''), now))

    conn.commit()
    conn.close()
    print("导入完成: printers=%d consumables=%d spare_items=%d spare_stocks=%d flows=%d" % (
        len(d.get('printers', [])), len(d.get('consumables', [])),
        len(d.get('spare_items', [])), len(d.get('spare_stocks', [])),
        len(d.get('spare_flows_in', [])) + len(d.get('spare_flows_out', []))))
    return True


if __name__ == '__main__':
    init_db()
    if os.path.exists(CLEAN_JSON):
        import_data(CLEAN_JSON)
    else:
        print("未找到", CLEAN_JSON)
