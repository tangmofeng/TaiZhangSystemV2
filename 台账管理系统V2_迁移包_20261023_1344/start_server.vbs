Set ws = CreateObject("Wscript.Shell")
' V2 启动脚本：pythonw 无窗口运行后端
' 端口：8090（V2 正式端口，接管原 V1 地址）
ws.Environment("PROCESS")("TZ_PORT") = "8090"
ws.Run """C:\Users\Administrator\AppData\Local\Programs\Python\Python311\pythonw.exe"" ""D:\TaiZhangSystemV2\server\app.py""", 0, False
