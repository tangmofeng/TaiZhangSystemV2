# -*- coding: utf-8 -*-
"""台账系统 V2 看门狗：检测 8090 未监听则自动拉起（无窗口，pythonw 运行）"""
import socket, subprocess, datetime, os

ROOT = r'D:\TaiZhangSystemV2'
PYW = r'C:\Users\Administrator\AppData\Local\Programs\Python\Python311\pythonw.exe'
PORT = 8090
LOG = os.path.join(ROOT, 'watchdog.log')
CREATE_NO_WINDOW = 0x08000000


def is_up():
    # 端口可连接
    s = socket.socket()
    s.settimeout(2)
    try:
        s.connect(('127.0.0.1', PORT))
        ok = True
    except Exception:
        ok = False
    finally:
        s.close()
    if not ok:
        return False
    # 已存在运行中的 V2 实例则视为正常（防止端口检测误判导致重复拉起成双实例）
    try:
        import subprocess as sp
        out = sp.check_output(
            ['wmic', 'process', 'where', "name='pythonw.exe'", 'get', 'commandline'],
            creationflags=CREATE_NO_WINDOW, timeout=10)
        text = out.decode('utf-8', 'ignore').lower()
        return 'server\\app.py' in text or 'server/app.py' in text
    except Exception:
        return True  # 查询失败时仅以端口为准，保持原行为


def log(msg):
    try:
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write('%s %s\n' % (datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), msg))
    except Exception:
        pass


if not is_up():
    log('检测到服务掉线，正在自动拉起…')
    try:
        env = dict(os.environ)
        env['TZ_PORT'] = str(PORT)
        subprocess.Popen([PYW, os.path.join(ROOT, 'server', 'app.py')],
                         cwd=ROOT, env=env, creationflags=CREATE_NO_WINDOW)
        log('已执行拉起命令 pythonw server\\app.py (TZ_PORT=%d)' % PORT)
    except Exception as e:
        log('拉起失败: %s' % e)
else:
    log('服务正常')
