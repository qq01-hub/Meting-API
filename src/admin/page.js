const getAdminHtml = () => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenMusic-Meitng 管理后台</title>
    <style>
        :root {
            --primary: #6366f1;
            --primary-light: #818cf8;
            --primary-dark: #4f46e5;
            --primary-bg: rgba(99,102,241,0.07);
            --primary-border: rgba(99,102,241,0.2);
            --success: #10b981;
            --success-bg: rgba(16,185,129,0.07);
            --warning: #f59e0b;
            --warning-bg: rgba(245,158,11,0.07);
            --danger: #ef4444;
            --danger-bg: rgba(239,68,68,0.07);
            --info: #3b82f6;
            --info-bg: rgba(59,130,246,0.07);
            --bg: #f1f5f9;
            --bg-card: #ffffff;
            --bg-sidebar: #0f172a;
            --bg-sidebar-hover: rgba(255,255,255,0.06);
            --bg-sidebar-active: rgba(99,102,241,0.15);
            --text: #1e293b;
            --text-secondary: #64748b;
            --text-muted: #94a3b8;
            --text-sidebar: #94a3b8;
            --text-sidebar-active: #ffffff;
            --border: #e2e8f0;
            --border-light: #f1f5f9;
            --shadow-xs: 0 1px 2px rgba(0,0,0,0.03);
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
            --shadow: 0 2px 8px rgba(0,0,0,0.06);
            --shadow-md: 0 4px 12px rgba(0,0,0,0.07);
            --shadow-lg: 0 12px 24px rgba(0,0,0,0.1);
            --radius: 10px;
            --radius-sm: 6px;
            --radius-lg: 14px;
            --transition: 0.2s cubic-bezier(0.4,0,0.2,1);
            --transition-slow: 0.35s cubic-bezier(0.4,0,0.2,1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html { scroll-behavior: smooth; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            background: var(--bg);
            min-height: 100vh;
            color: var(--text);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            background-size: 200% 200%;
            animation: gradientShift 8s ease infinite;
            padding: 20px;
            position: relative;
            overflow: hidden;
        }
        .login-container::before {
            content: '';
            position: absolute;
            width: 500px;
            height: 500px;
            background: rgba(255,255,255,0.08);
            border-radius: 50%;
            top: -150px;
            right: -100px;
            animation: float 6s ease-in-out infinite;
        }
        .login-container::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: rgba(255,255,255,0.05);
            border-radius: 50%;
            bottom: -80px;
            left: -60px;
            animation: float 8s ease-in-out infinite reverse;
        }

        .login-box {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(20px);
            padding: 48px 40px;
            border-radius: var(--radius-lg);
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            width: 100%;
            max-width: 420px;
            animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1);
            position: relative;
            z-index: 1;
        }
        .login-box h1 {
            text-align: center;
            margin-bottom: 6px;
            color: var(--text);
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        .login-box .login-subtitle {
            text-align: center;
            color: var(--text-secondary);
            font-size: 14px;
            margin-bottom: 36px;
        }

        .form-group { margin-bottom: 20px; }
        .form-group label {
            display: block;
            margin-bottom: 6px;
            color: var(--text);
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.01em;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 10px 14px;
            border: 1.5px solid var(--border);
            border-radius: var(--radius-sm);
            font-size: 14px;
            color: var(--text);
            background: var(--bg-card);
            transition: var(--transition);
            font-family: inherit;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-bg);
        }
        .form-group input:disabled {
            background: #f1f5f9;
            color: var(--text-muted);
            cursor: not-allowed;
        }
        .form-group input::placeholder,
        .form-group textarea::placeholder { color: var(--text-muted); }
        .form-group small { color: var(--text-muted); display: block; margin-top: 4px; font-size: 12px; }
        .form-group select {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 36px;
        }
        .form-group textarea { resize: vertical; min-height: 80px; line-height: 1.5; }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 9px 18px;
            border: none;
            border-radius: var(--radius-sm);
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: var(--transition);
            white-space: nowrap;
            font-family: inherit;
            position: relative;
            overflow: hidden;
        }
        .btn:active { transform: scale(0.97); }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-dark); box-shadow: 0 4px 12px rgba(99,102,241,0.35); }
        .btn-danger { background: var(--danger); color: white; }
        .btn-danger:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239,68,68,0.35); }
        .btn-default { background: var(--bg-card); border: 1.5px solid var(--border); color: var(--text); }
        .btn-default:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-bg); }
        .btn-success { background: var(--success); color: white; }
        .btn-success:hover { background: #059669; box-shadow: 0 4px 12px rgba(16,185,129,0.35); }
        .btn-warning { background: var(--warning); color: white; }
        .btn-warning:hover { background: #d97706; box-shadow: 0 4px 12px rgba(245,158,11,0.35); }
        .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 5px; }
        .btn-lg { padding: 12px 28px; font-size: 15px; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-full { width: 100%; }

        .error-msg { color: var(--danger); font-size: 13px; margin-top: 12px; text-align: center; min-height: 20px; }

        .admin-container { display: none; }

        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 230px;
            height: 100vh;
            background: var(--bg-sidebar);
            color: var(--text-sidebar);
            z-index: 100;
            display: flex;
            flex-direction: column;
            transition: width var(--transition-slow);
        }
        .sidebar-brand {
            padding: 24px 20px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .sidebar-brand h2 {
            font-size: 18px;
            font-weight: 800;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 10px;
            letter-spacing: -0.3px;
        }
        .sidebar-brand .brand-sub {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 4px;
            display: block;
            padding-left: 30px;
        }
        .sidebar-menu {
            list-style: none;
            padding: 12px 10px;
            flex: 1;
            overflow-y: auto;
        }
        .sidebar-menu li {
            padding: 10px 14px;
            cursor: pointer;
            border-radius: 8px;
            transition: var(--transition);
            font-size: 14px;
            color: var(--text-sidebar);
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 10px;
            position: relative;
        }
        .sidebar-menu li:hover {
            background: var(--bg-sidebar-hover);
            color: #e2e8f0;
        }
        .sidebar-menu li.active {
            background: var(--bg-sidebar-active);
            color: var(--text-sidebar-active);
            font-weight: 600;
        }
        .sidebar-menu li.active::before {
            content: '';
            position: absolute;
            left: -10px;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 20px;
            background: var(--primary-light);
            border-radius: 0 3px 3px 0;
        }
        .sidebar-menu li .menu-icon { font-size: 16px; width: 22px; text-align: center; flex-shrink: 0; }
        .sidebar-menu li .menu-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .main-content {
            margin-left: 230px;
            min-height: 100vh;
            transition: margin-left var(--transition-slow);
        }
        .header {
            background: var(--bg-card);
            padding: 16px 0;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .header-inner { width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 32px; display: flex; justify-content: space-between; align-items: center; }
        .header h3 { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
        .user-info { display: flex; align-items: center; gap: 16px; }
        .user-info .user-name { font-size: 13px; color: var(--text-secondary); font-weight: 500; }

        .page-content { padding: 28px 32px; max-width: 1400px; margin: 0 auto; }
        .content-section { display: none; animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1); }
        .content-section.active { display: block; }

        .card {
            background: var(--bg-card);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            padding: 24px;
            margin-bottom: 20px;
            transition: box-shadow var(--transition), transform var(--transition);
        }
        .card:hover { box-shadow: var(--shadow); }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .card-title { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 18px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--bg-card);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            padding: 22px;
            transition: var(--transition-slow);
            position: relative;
            overflow: hidden;
        }
        .stat-card::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            opacity: 0.04;
            transform: translate(20px, -20px);
        }
        .stat-card.blue::after { background: var(--primary); }
        .stat-card.green::after { background: var(--success); }
        .stat-card.orange::after { background: var(--warning); }
        .stat-card.red::after { background: var(--danger); }
        .stat-card:hover {
            box-shadow: var(--shadow-md);
            transform: translateY(-3px);
        }
        .stat-icon {
            width: 42px;
            height: 42px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            margin-bottom: 14px;
        }
        .stat-icon.blue { background: var(--primary-bg); }
        .stat-icon.green { background: var(--success-bg); }
        .stat-icon.orange { background: var(--warning-bg); }
        .stat-icon.red { background: var(--danger-bg); }
        .stat-value { font-size: 30px; font-weight: 800; color: var(--text); line-height: 1.1; letter-spacing: -0.5px; }
        .stat-label { color: var(--text-secondary); margin-top: 6px; font-size: 13px; font-weight: 500; }

        .table-container { overflow-x: auto; border-radius: var(--radius-sm); }
        .table { width: 100%; border-collapse: collapse; }
        .table th {
            padding: 12px 16px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.6px;
            border-bottom: 2px solid var(--border);
            background: transparent;
        }
        .table td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--border-light);
            font-size: 13px;
            color: var(--text);
            vertical-align: middle;
        }
        .table tbody tr { transition: var(--transition); }
        .table tbody tr:nth-child(even) { background: #fafbfc; }
        .table tbody tr:hover { background: var(--primary-bg); }
        .table tbody tr:last-child td { border-bottom: none; }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.01em;
        }
        .badge-success { background: var(--success-bg); color: var(--success); }
        .badge-warning { background: var(--warning-bg); color: var(--warning); }
        .badge-info { background: var(--info-bg); color: var(--info); }
        .badge-error { background: var(--danger-bg); color: var(--danger); }
        .badge-primary { background: var(--primary-bg); color: var(--primary); }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15,23,42,0.4);
            backdrop-filter: blur(6px);
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal.show { display: flex; }
        .modal-content {
            background: var(--bg-card);
            padding: 0;
            border-radius: var(--radius-lg);
            width: 100%;
            max-width: 520px;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: var(--shadow-lg);
            animation: modalIn 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
        }
        .modal-header h3 { font-size: 16px; font-weight: 700; }
        .modal-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: var(--text-muted);
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: var(--transition);
        }
        .modal-close:hover { background: #f1f5f9; color: var(--text); }
        .modal-body { padding: 24px; }
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--border-light);
            border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        }

        /* 扫码登录弹窗 */
        .qr-platform-tabs {
            display: flex;
            gap: 6px;
            padding: 6px;
            margin-bottom: 18px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
        }
        .qr-platform-tab {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 9px 6px;
            border: none;
            border-radius: var(--radius-sm);
            background: transparent;
            color: var(--text-secondary);
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            white-space: nowrap;
        }
        .qr-platform-tab:hover:not(:disabled) { background: rgba(15,23,42,0.04); color: var(--text); }
        .qr-platform-tab.active {
            background: var(--bg-card);
            color: var(--primary);
            box-shadow: var(--shadow-sm);
        }
        .qr-platform-tab:disabled { opacity: 0.45; cursor: not-allowed; }
        .qr-platform-tab .qr-tab-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--text-muted);
            flex-shrink: 0;
        }
        .qr-platform-tab .qr-tab-dot.busy { background: var(--warning); animation: pulseDot 1.2s ease-in-out infinite; }
        .qr-platform-tab .qr-tab-dot.ok { background: var(--success); }
        .qr-platform-tab .qr-tab-dot.err { background: var(--danger); }

        .qr-panel { text-align: center; }
        .qr-stage {
            position: relative;
            width: 220px;
            height: 220px;
            margin: 0 auto 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
        }
        .qr-stage img { width: 100%; height: 100%; object-fit: contain; }
        .qr-stage .qr-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            color: var(--text-muted);
            font-size: 12px;
        }
        .qr-spinner {
            width: 26px;
            height: 26px;
            border: 2.5px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        .qr-stage .qr-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: rgba(255,255,255,0.94);
            color: var(--text);
            font-size: 13px;
            font-weight: 600;
            text-align: center;
            padding: 16px;
        }
        .qr-stage .qr-overlay.expired { color: var(--danger); }
        .qr-stage .qr-overlay .qr-expired-icon { font-size: 28px; }
        .qr-instruction {
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
            margin: 0 0 6px;
        }
        .qr-status {
            font-size: 12px;
            color: var(--text-secondary);
            min-height: 18px;
            margin: 0;
            line-height: 1.5;
        }
        .qr-status.error { color: var(--danger); }
        .qr-status.success { color: var(--success); font-weight: 600; }
        .qr-hint {
            margin-top: 16px;
            padding: 10px 12px;
            background: var(--primary-bg);
            border: 1px solid var(--primary-border);
            border-radius: var(--radius-sm);
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.6;
            text-align: left;
        }
        .qr-verify-frame {
            display: none;
            margin-top: 14px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            background: #fff;
        }
        .qr-verify-frame.show { display: block; }
        .qr-verify-frame .qr-verify-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            font-size: 12px;
            font-weight: 600;
            color: var(--text);
            background: var(--border-light);
        }
        .qr-verify-frame iframe { display: block; width: 100%; height: 380px; border: 0; }
        .qr-link-btn {
            background: none;
            border: none;
            font-family: inherit;
            font-size: 12px;
            color: var(--text-muted);
            text-decoration: underline;
            cursor: pointer;
            padding: 0;
        }
        .qr-link-btn:hover { color: var(--primary); }

        .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
            vertical-align: middle;
        }
        .status-active {
            background: var(--success);
            box-shadow: 0 0 0 3px var(--success-bg);
            animation: pulse 2s ease-in-out infinite;
        }
        .status-inactive { background: var(--text-muted); }

        .toast {
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 14px 22px;
            border-radius: var(--radius-sm);
            color: white;
            z-index: 2000;
            animation: slideIn 0.35s cubic-bezier(0.16,1,0.3,1);
            font-size: 13px;
            font-weight: 600;
            box-shadow: var(--shadow-md);
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 360px;
        }
        .toast-success { background: var(--success); }
        .toast-error { background: var(--danger); }

        .cookie-preview {
            font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
            font-size: 12px;
            color: var(--text-secondary);
            max-width: 160px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }

        .empty-state {
            text-align: center;
            padding: 56px 20px;
            color: var(--text-muted);
        }
        .empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
        .empty-state-text { font-size: 14px; font-weight: 500; }

        .validation-status { display: flex; align-items: center; gap: 8px; }
        .user-info-tooltip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
        .url-error-count { white-space: nowrap; }
        .cookie-error-counts { display: flex; gap: 12px; }
        .slider-error-count { white-space: nowrap; }
        .tencent-verify-banner { padding: 20px 24px; margin-bottom: 20px; border: 1px solid var(--border); box-shadow: none; }
        .tencent-verify-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        .tencent-verify-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 650; }
        .tencent-verify-icon { width: 20px; height: 20px; flex-shrink: 0; color: #92400e; }
        .tencent-verify-count { font-size: 12px; color: #92400e; background: var(--warning-bg); padding: 5px 10px; border-radius: var(--radius-sm); white-space: nowrap; }
        .tencent-verify-description { margin-top: 6px; font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
        .tencent-verify-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(200px, 280px); gap: 24px; }
        .tencent-verify-account { font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
        .tencent-verify-identity { margin-top: 5px; font-size: 12px; color: var(--text-secondary); overflow-wrap: anywhere; }
        .tencent-verify-message { margin: 12px 0; font-size: 13px; line-height: 1.6; color: var(--text-secondary); overflow-wrap: anywhere; }
        .tencent-verify-stats { display: flex; flex-wrap: wrap; gap: 12px 28px; margin-bottom: 16px; }
        .tencent-verify-stats dt { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
        .tencent-verify-stats dd { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .tencent-verify-selector label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
        .tencent-verify-selector select { width: 100%; padding: 10px 12px; color: var(--text); background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); font: inherit; font-size: 13px; }
        .tencent-verify-selector select:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .tencent-verify-selector p { font-size: 12px; line-height: 1.7; color: var(--text-secondary); margin-top: 10px; }
        .tencent-verify-banner .btn { min-height: 36px; }
        @media (max-width: 640px) {
            .tencent-verify-banner { padding: 16px; }
            .tencent-verify-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
            .tencent-verify-header { flex-wrap: wrap; gap: 8px; }
            .tencent-verify-stats { gap: 12px 20px; }
        }

        .loading {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        .skeleton {
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s ease-in-out infinite;
            border-radius: var(--radius-sm);
        }
        .skeleton-text { height: 14px; margin-bottom: 8px; }
        .skeleton-text.short { width: 60%; }

        .help-link {
            display: block;
            text-align: center;
            margin-top: 16px;
            color: var(--primary);
            font-size: 13px;
            cursor: pointer;
            transition: var(--transition);
            font-weight: 500;
        }
        .help-link:hover { text-decoration: underline; }
        .help-content {
            display: none;
            margin-top: 16px;
            padding: 16px;
            background: #f8fafc;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            text-align: left;
            font-size: 12px;
            line-height: 1.8;
        }
        .help-content.show { display: block; animation: fadeUp 0.25s ease; }
        .help-content h4 { margin-bottom: 8px; color: var(--text); font-size: 13px; font-weight: 600; }
        .help-content ol { margin-left: 16px; color: var(--text-secondary); }
        .help-content code {
            background: var(--primary-bg);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 11px;
            color: var(--primary);
        }
        .help-section { margin-bottom: 16px; }

        .divider { margin: 28px 0; border: none; border-top: 1px solid var(--border); }

        .form-row { display: flex; gap: 12px; }

        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-size: 13px;
            color: var(--text);
            font-weight: 500;
        }
        .checkbox-label input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: var(--primary);
            cursor: pointer;
        }

        .settings-grid { display: grid; grid-template-columns: 1fr; gap: 24px; max-width: 520px; }
        .settings-section h4 {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 18px;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .monitor-status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 14px;
            margin-bottom: 24px;
        }
        .monitor-status-card {
            background: #f8fafc;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 18px;
            text-align: center;
            transition: var(--transition);
        }
        .monitor-status-card:hover { border-color: var(--primary-border); }
        .monitor-status-card .stat-value { font-size: 22px; font-weight: 800; }
        .monitor-status-card .stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-weight: 500; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 3px var(--success-bg); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.1); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }

        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                height: auto;
                position: fixed;
                bottom: 0;
                top: auto;
                left: 0;
                right: 0;
                z-index: 100;
                flex-direction: row;
                border-top: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 -2px 12px rgba(0,0,0,0.15);
            }
            .sidebar-brand { display: none; }
            .sidebar-menu {
                display: flex;
                flex-direction: row;
                padding: 0;
                width: 100%;
                overflow-x: auto;
                overflow-y: hidden;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
            }
            .sidebar-menu::-webkit-scrollbar { display: none; }
            .sidebar-menu li {
                flex: 1;
                min-width: 0;
                justify-content: center;
                padding: 10px 6px;
                margin-bottom: 0;
                border-radius: 0;
                flex-direction: column;
                gap: 3px;
                font-size: 10px;
            }
            .sidebar-menu li .menu-icon { font-size: 18px; width: auto; }
            .sidebar-menu li .menu-text { font-size: 10px; white-space: nowrap; }
            .sidebar-menu li.active::before { display: none; }
            .sidebar-menu li.active {
                background: var(--bg-sidebar-active);
                color: var(--primary-light);
            }
            .main-content {
                margin-left: 0;
                margin-bottom: 60px;
                min-height: calc(100vh - 60px);
            }
            .page-content { padding: 16px 14px; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .stat-card { padding: 16px; }
            .stat-value { font-size: 24px; }
            .stat-icon { width: 36px; height: 36px; font-size: 15px; margin-bottom: 10px; }
            .header { padding: 10px 0; }
            .header-inner { padding: 0 14px; }
            .header h3 { font-size: 15px; }
            .card { padding: 16px; margin-bottom: 14px; }
            .card-header { flex-wrap: wrap; gap: 10px; }
            .modal-content { margin: 12px; max-width: calc(100% - 24px); max-height: 90vh; }
            .modal-body { padding: 16px; }
            .modal-header { padding: 16px; }
            .modal-footer { padding: 12px 16px; }
            .qr-platform-tabs { gap: 4px; padding: 5px; }
            .qr-platform-tab { padding: 8px 4px; font-size: 12px; }
            .qr-stage { width: 190px; height: 190px; }
            .qr-verify-frame iframe { height: 320px; }
            .table th, .table td { padding: 10px 10px; font-size: 12px; }
            .cookie-preview { max-width: 100px; }
            .actions { flex-wrap: wrap; }
            .btn-sm { padding: 5px 8px; font-size: 11px; }
            .form-row { flex-direction: column; gap: 0; }
            .toast { top: auto; bottom: 72px; right: 12px; left: 12px; max-width: none; font-size: 12px; padding: 10px 14px; }
            .monitor-status-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .settings-grid { max-width: none; }
            .user-info .user-name { display: none; }
        }

        @media (max-width: 480px) {
            .stats-grid { grid-template-columns: 1fr; }
            .login-box { padding: 28px 20px; }
            .login-box h1 { font-size: 22px; }
            .stat-value { font-size: 22px; }
            .card-title { font-size: 14px; }
            .monitor-status-grid { grid-template-columns: 1fr 1fr; }
            .badge { font-size: 11px; padding: 2px 8px; }
        }

        @media (max-width: 360px) {
            .sidebar-menu li { padding: 8px 4px; font-size: 9px; }
            .sidebar-menu li .menu-icon { font-size: 16px; }
            .sidebar-menu li .menu-text { font-size: 9px; }
            .page-content { padding: 12px 10px; }
        }
    </style>
</head>
<body>
    <div class="login-container" id="loginContainer">
        <div class="login-box" id="loginBox">
            <h1>🎵 OpenMusic-Meitng</h1>
            <p class="login-subtitle">管理后台登录</p>
            <form id="loginForm">
                <div class="form-group">
                    <label>用户名</label>
                    <input type="text" id="loginUsername" required placeholder="请输入用户名">
                </div>
                <div class="form-group">
                    <label>密码</label>
                    <input type="password" id="loginPassword" required placeholder="请输入密码">
                </div>
                <div class="error-msg" id="loginError"></div>
                <button type="submit" class="btn btn-primary btn-lg btn-full" style="margin-top:8px;">登 录</button>
            </form>
        </div>
        <div class="login-box" id="twoFactorBox" style="display:none;">
            <h1>🔐 双因素认证</h1>
            <p class="login-subtitle">请输入认证器中的验证码</p>
            <form id="twoFactorForm">
                <input type="hidden" id="twoFactorUsername">
                <div class="form-group">
                    <label>验证码</label>
                    <input type="text" id="twoFactorCode" required placeholder="6位数字验证码" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" style="text-align:center;font-size:24px;letter-spacing:8px;font-weight:700;">
                </div>
                <div class="error-msg" id="twoFactorError"></div>
                <button type="submit" class="btn btn-primary btn-lg btn-full" style="margin-top:8px;">验 证</button>
                <button type="button" class="btn btn-default btn-full" style="margin-top:8px;" onclick="cancel2FA()">返回登录</button>
            </form>
        </div>
    </div>

    <div class="admin-container" id="adminContainer">
        <div class="sidebar">
            <div class="sidebar-brand">
                <h2>🎵 <span class="brand-text">Meting</span></h2>
                <span class="brand-sub">管理后台</span>
            </div>
            <ul class="sidebar-menu">
                <li class="active" data-section="dashboard"><span class="menu-icon">📊</span><span class="menu-text">仪表盘</span></li>
                <li data-section="cookies"><span class="menu-icon">🍪</span><span class="menu-text">Cookie管理</span></li>
                <li data-section="monitor"><span class="menu-icon">🔔</span><span class="menu-text">Cookie监测</span></li>
                <li data-section="tokens"><span class="menu-icon">🔑</span><span class="menu-text">API Token</span></li>
                <li data-section="users"><span class="menu-icon">👥</span><span class="menu-text">用户管理</span></li>
                <li data-section="logs"><span class="menu-icon">📋</span><span class="menu-text">操作日志</span></li>
                <li data-section="settings"><span class="menu-icon">⚙️</span><span class="menu-text">设置</span></li>
            </ul>
        </div>
        <div class="main-content">
            <div class="header">
                <div class="header-inner">
                    <h3 id="pageTitle">仪表盘</h3>
                    <div class="user-info">
                        <span class="user-name" id="currentUser"></span>
                        <button class="btn btn-default btn-sm" onclick="logout()">退出登录</button>
                    </div>
                </div>
            </div>

            <div class="page-content">
                <div class="content-section active" id="dashboardSection">
                    <div class="stats-grid">
                        <div class="stat-card blue">
                            <div class="stat-icon blue">🍪</div>
                            <div class="stat-value" id="totalCookies">0</div>
                            <div class="stat-label">Cookie总数</div>
                        </div>
                        <div class="stat-card green">
                            <div class="stat-icon green">✓</div>
                            <div class="stat-value" id="validCookies">0</div>
                            <div class="stat-label">有效Cookie</div>
                        </div>
                        <div class="stat-card orange">
                            <div class="stat-icon orange">👥</div>
                            <div class="stat-value" id="totalUsers">0</div>
                            <div class="stat-label">用户总数</div>
                        </div>
                        <div class="stat-card red">
                            <div class="stat-icon red">📋</div>
                            <div class="stat-value" id="totalLogs">0</div>
                            <div class="stat-label">操作记录</div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">最近操作</span>
                        </div>
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr><th>时间</th><th>操作</th><th>详情</th><th>操作人</th></tr>
                                </thead>
                                <tbody id="recentLogs"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="cookiesSection">
                    <div class="card tencent-verify-banner" id="tencentVerifyBanner" style="display:none;">
                        <div class="tencent-verify-header">
                            <div>
                                <h3 class="tencent-verify-title"><svg class="tencent-verify-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z" stroke-linejoin="round"/><path d="M12 9v5m0 3v1" stroke-linecap="round"/></svg><span id="tencentVerifyHeading">QQ 音乐需要滑块验证</span></h3>
                                <p class="tencent-verify-description">查看受影响账号，完成验证后可提前恢复自动选用。</p>
                            </div>
                            <span class="tencent-verify-count" id="tencentVerifyCount" role="status"></span>
                        </div>
                        <div class="tencent-verify-layout">
                            <div>
                                <div class="tencent-verify-account" id="tencentVerifyAccount"></div>
                                <div class="tencent-verify-identity" id="tencentVerifyIdentity"></div>
                                <p class="tencent-verify-message" id="tencentVerifyMessage"></p>
                                <dl class="tencent-verify-stats">
                                    <div><dt>URL 获取失败</dt><dd id="tencentVerifyFailures"></dd></div>
                                    <div><dt>累计滑块</dt><dd id="tencentVerifySliders"></dd></div>
                                    <div><dt>冷却状态</dt><dd id="tencentVerifyCooldown"></dd></div>
                                </dl>
                                <div class="form-group" id="tencentVerifySongGroup" style="display:none;max-width:360px;margin:8px 0 12px;"><label for="tencentVerifySongmid">歌曲 ID</label><input id="tencentVerifySongmid" type="text" placeholder="输入遇到播放失败的 QQ 音乐歌曲 ID"></div>
                                <div class="actions">
                                    <button type="button" class="btn btn-primary btn-sm" id="tencentVerifyOpen" onclick="openTencentVerification()">打开滑块验证</button>
                                    <button type="button" class="btn btn-default btn-sm" id="tencentVerifyRetry" onclick="retryTencentVerification()">完成后重试</button>
                                </div>
                            </div>
                            <div class="tencent-verify-selector">
                                <label for="tencentVerifyAccountSelect">待处理账号</label>
                                <select id="tencentVerifyAccountSelect" onchange="selectTencentVerification(this.value)"></select>
                                <p>仅验证选中的账号，不影响其他 Cookie。滑块触发后冷却 1 小时；普通播放失败不代表一定需要滑块验证。</p>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Cookie列表</span>
                            <div class="actions">
                                <button class="btn btn-default btn-sm" onclick="showQrLoginModal()">扫码登录</button>
                                <button class="btn btn-primary btn-sm" onclick="showAddCookieModal()">+ 添加Cookie</button>
                            </div>
                        </div>
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr><th>平台</th><th>Cookie预览</th><th>备注</th><th>验证状态</th><th>启用</th><th>创建时间</th><th>操作</th></tr>
                                </thead>
                                <tbody id="cookiesList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="monitorSection">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">监测状态</span>
                            <button class="btn btn-primary btn-sm" onclick="checkNow()">立即检查</button>
                        </div>
                        <div class="monitor-status-grid">
                            <div class="monitor-status-card">
                                <div class="stat-value" id="monitorStatus">-</div>
                                <div class="stat-label">监测状态</div>
                            </div>
                            <div class="monitor-status-card">
                                <div class="stat-value" id="monitorInterval">-</div>
                                <div class="stat-label">检查间隔(分钟)</div>
                            </div>
                            <div class="monitor-status-card">
                                <div class="stat-value" id="monitorCheckCount">0</div>
                                <div class="stat-label">检查次数</div>
                            </div>
                            <div class="monitor-status-card">
                                <div class="stat-value" id="monitorLastCheck">-</div>
                                <div class="stat-label">上次检查</div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">监测设置</span></div>
                        <form id="monitorForm" style="max-width: 400px;">
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="monitorEnabled"> 启用定时监测</label>
                            </div>
                            <div class="form-group">
                                <label>检查间隔（分钟）</label>
                                <input type="number" id="monitorIntervalInput" min="5" max="1440" value="60">
                                <small>最小5分钟，最大1440分钟(24小时)</small>
                            </div>
                            <button type="submit" class="btn btn-primary">保存设置</button>
                        </form>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">汽水音乐签名服务</span></div>
                        <form id="qishuiSignerForm" style="max-width: 600px;">
                            <div class="form-group">
                                <label>签名接口地址</label>
                                <input type="url" id="qishuiSignerUrl" placeholder="http://qishui-signer:8080/sign">
                                <small>填写独立 qishui-signer 容器的 /sign 地址；留空则使用本地签名模式。</small>
                            </div>
                            <button type="submit" class="btn btn-primary">保存签名地址</button>
                        </form>
                    </div>
                    <div class="card">
                        <div class="card-header"><span class="card-title">音频响度辅助服务</span></div>
                        <form id="loudnessServiceForm" style="max-width: 600px;">
                            <div class="form-group">
                                <label>响度接口地址</label>
                                <input type="url" id="loudnessServiceUrl" placeholder="http://meting-api-audio-loudness:3100/analyze">
                                <small>填写辅助项目的 /analyze 地址；留空则使用平台返回的响度。</small>
                            </div>
                            <button type="submit" class="btn btn-primary">保存响度地址</button>
                        </form>
                    </div>
<div class="card">
                        <div class="card-header"><span class="card-title">Webhook通知设置</span></div>
                        <form id="webhookForm" style="max-width: 600px;">
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="webhookEnabled"> 启用Webhook通知</label>
                            </div>
                            <div class="form-group">
                                <label>Webhook URL</label>
                                <input type="text" id="webhookUrl" placeholder="https://example.com/webhook">
                            </div>
                            <div class="form-group">
                                <label>Content-Type</label>
                                <select id="webhookContentType" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px;">
                                    <option value="application/json">application/json</option>
                                    <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                                </select>
                                <small>根据目标服务要求选择</small>
                            </div>
                            <div class="form-group">
                                <label>自定义 Headers (JSON格式)</label>
                                <textarea id="webhookHeaders" rows="3" placeholder='{"Authorization": "Bearer xxx"}'></textarea>
                                <small>可选，用于添加认证等自定义请求头</small>
                            </div>
                            <div class="form-group">
                                <label>Body 模板 (JSON格式，可选)</label>
                                <textarea id="webhookBodyTemplate" rows="5" placeholder='{"msgtype":"markdown","markdown":{"title":"{{title}}","text":"{{message}}"}}'></textarea>
                                <small>留空使用默认格式。支持变量: {{title}}, {{message}}, {{priority}}, {{event}}, {{time}}</small>
                            </div>
                            <div class="form-row">
                                <button type="submit" class="btn btn-primary">保存Webhook</button>
                                <button type="button" class="btn btn-default" onclick="testWebhook()">测试发送</button>
                            </div>
                        </form>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">监测历史</span></div>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>时间</th><th>类型</th><th>详情</th></tr></thead>
                                <tbody id="monitorLogsList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="usersSection">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">用户列表</span>
                            <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">+ 添加用户</button>
                        </div>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>用户名</th><th>角色</th><th>创建时间</th><th>最后登录</th><th>操作</th></tr></thead>
                                <tbody id="usersList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="logsSection">
                    <div class="card">
                        <div class="card-header"><span class="card-title">操作日志</span></div>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>时间</th><th>操作类型</th><th>详情</th><th>操作人</th></tr></thead>
                                <tbody id="logsList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="tokensSection">
                    <div class="card">
                        <div class="card-header">
                            <h4>🔑 API Token 管理</h4>
                            <button class="btn btn-primary" onclick="showTokenModal()">创建 Token</button>
                        </div>
                        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">API Token 用于程序化访问管理接口，使用 <code>Authorization: Bearer &lt;token&gt;</code> 请求头认证。</p>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>Token</th>
                                        <th>创建时间</th>
                                        <th>最后使用</th>
                                        <th>使用次数</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="tokensList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="settingsSection">
                    <div class="settings-grid">
                        <div class="card settings-section">
                            <h4>👤 个人设置</h4>
                            <form id="profileForm">
                                <div class="form-group">
                                    <label>当前用户名</label>
                                    <input type="text" id="currentUsernameDisplay" disabled>
                                </div>
                                <div class="form-group">
                                    <label>新用户名</label>
                                    <input type="text" id="newUsername" placeholder="留空则不修改">
                                </div>
                                <button type="submit" class="btn btn-primary">修改用户名</button>
                            </form>
                        </div>

                        <div class="card settings-section">
                            <h4>🔒 修改密码</h4>
                            <form id="changePasswordForm">
                                <div class="form-group">
                                    <label>旧密码</label>
                                    <input type="password" id="oldPassword" required>
                                </div>
                                <div class="form-group">
                                    <label>新密码</label>
                                    <input type="password" id="newPassword" required>
                                </div>
                                <div class="form-group">
                                    <label>确认新密码</label>
                                    <input type="password" id="confirmPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary">修改密码</button>
                            </form>
                        </div>

                        <div class="card settings-section" id="adminPathSection">
                            <h4>🛡️ 安全设置</h4>
                            <form id="adminPathForm">
                                <div class="form-group">
                                    <label>管理后台路径</label>
                                    <input type="text" id="adminPathInput" placeholder="例如: secret-admin">
                                    <small>修改后需要重启服务才能生效</small>
                                </div>
                                <button type="submit" class="btn btn-primary">保存路径</button>
                            </form>
                        </div>

                        <div class="card settings-section" id="twoFactorSection">
                            <h4>🔐 双因素认证</h4>
                            <div id="twoFactorDisabled">
                                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">双因素认证可为您的账户提供额外安全保障，启用后登录时需要输入验证码。</p>
                                <button type="button" class="btn btn-primary" onclick="startSetup2FA()">启用双因素认证</button>
                            </div>
                            <div id="twoFactorEnabled" style="display:none;">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                                    <span class="status-dot status-active"></span>
                                    <span style="color:var(--success);font-weight:600;font-size:14px;">已启用</span>
                                </div>
                                <button type="button" class="btn btn-danger" onclick="showDisable2FAModal()">禁用双因素认证</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal" id="cookieModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="cookieModalTitle">添加Cookie</h3>
                <button class="modal-close" onclick="closeModal('cookieModal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="cookieForm">
                    <input type="hidden" id="cookieId">
                    <div class="form-group">
                        <label>平台</label>
                        <select id="cookiePlatform" required>
                            <option value="netease">网易云音乐</option>
                            <option value="tencent">QQ音乐</option>
                            <option value="qishui">汽水音乐</option>
                            <option value="kugou">酷狗音乐</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Cookie数据</label>
                        <textarea id="cookieData" rows="4" required placeholder="请粘贴Cookie数据"></textarea>
                    </div>
                    <div class="form-group">
                        <label>备注</label>
                        <input type="text" id="cookieNote" placeholder="可选备注信息">
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label"><input type="checkbox" id="skipValidation"> 跳过在线验证（不推荐）</label>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label"><input type="checkbox" id="cookieActive" checked> 启用此Cookie</label>
                    </div>
                </form>
                <span class="help-link" onclick="toggleCookieHelp()">❓ 如何获取Cookie？</span>
                <div class="help-content" id="cookieHelpContent">
                    <div class="help-section">
                        <h4>网易云音乐 Cookie 获取方法：</h4>
                        <ol>
                            <li>登录 <a href="https://music.163.com" target="_blank">music.163.com</a></li>
                            <li>按 F12 打开开发者工具</li>
                            <li>切换到 Network（网络）标签</li>
                            <li>刷新页面，点击任意请求</li>
                            <li>在 Headers（请求头）中找到 Cookie</li>
                            <li>复制完整 Cookie 值（需包含 <code>MUSIC_U</code>）</li>
                        </ol>
                    </div>
                    <div class="help-section">
                        <h4>QQ音乐 Cookie 获取方法：</h4>
                        <ol>
                            <li>登录 <a href="https://y.qq.com" target="_blank">y.qq.com</a></li>
                            <li>按 F12 打开开发者工具</li>
                            <li>切换到 Application（应用）标签</li>
                            <li>在左侧 Cookies 下找到 y.qq.com</li>
                            <li>复制 <code>uin</code> 和 <code>qqmusic_key</code> 的值</li>
                            <li>格式：<code>uin=你的uin; qqmusic_key=你的key</code></li>
                        </ol>
                    </div>
                    <div class="help-section">
                        <h4>汽水音乐 Cookie 获取方法：</h4>
                        <ol>
                            <li>登录汽水音乐网页版或使用管理端扫码登录</li>
                            <li>在开发者工具的 Application（应用）→ Cookies 中打开 qishui.com</li>
                            <li>复制完整 Cookie，至少需要包含 <code>sessionid</code>、<code>sessionid_ss</code>、<code>sid_guard</code> 或 <code>uid_tt</code> 之一</li>
                            <li>选择“汽水音乐”，粘贴 Cookie 后点击“保存并验证”</li>
                        </ol>
                    <div class="help-section">
                        <h4>酷狗音乐 Cookie 获取方法：</h4>
                        <ol>
                            <li>在已登录的酷狗客户端或可信接口响应中获取登录凭证</li>
                            <li>粘贴完整 Cookie，必须包含 <code>token</code> 和 <code>userid</code>；建议同时保留 <code>vip_token</code>、<code>vip_type</code>、<code>dfid</code> 与 <code>KUGOU_API_MID</code></li>
                            <li>选择“酷狗音乐”，粘贴 Cookie 后点击“保存并验证”</li>
                            <li>SVIP 音质会单独校验，不能按普通 VIP 处理</li>
                        </ol>
                    </div>                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('cookieModal')">取消</button>
                <button type="submit" class="btn btn-primary" id="cookieSubmitBtn" onclick="document.getElementById('cookieForm').dispatchEvent(new Event('submit',{cancelable:true}))">保存并验证</button>
            </div>
        </div>
    </div>

    <div class="modal" id="qrLoginModal">
        <div class="modal-content" style="max-width:440px;">
            <div class="modal-header">
                <h3>扫码登录</h3>
                <button class="modal-close" onclick="closeQrLoginModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="qr-platform-tabs" role="tablist" aria-label="选择音乐平台">
                    <button type="button" class="qr-platform-tab" role="tab" data-platform="netease" onclick="switchQrPlatform('netease')"><span>网易云</span><span class="qr-tab-dot"></span></button>
                    <button type="button" class="qr-platform-tab" role="tab" data-platform="tencent" onclick="switchQrPlatform('tencent')"><span>QQ 音乐</span><span class="qr-tab-dot"></span></button>
                    <button type="button" class="qr-platform-tab" role="tab" data-platform="kugou" onclick="switchQrPlatform('kugou')"><span>酷狗</span><span class="qr-tab-dot"></span></button>
                    <button type="button" class="qr-platform-tab" role="tab" data-platform="qishui" onclick="switchQrPlatform('qishui')"><span>汽水</span><span class="qr-tab-dot"></span></button>
                </div>
                <div class="qr-panel" id="qrPanel">
                    <div class="qr-stage" id="qrStage">
                        <div class="qr-placeholder" id="qrPlaceholder"><div class="qr-spinner"></div><span>正在生成二维码…</span></div>
                        <img id="qrImage" alt="登录二维码" style="display:none;">
                        <div class="qr-overlay" id="qrOverlay" style="display:none;"></div>
                    </div>
                    <p class="qr-instruction" id="qrInstruction">请使用手机 App 扫码</p>
                    <p class="qr-status" id="qrStatus">正在初始化…</p>
                    <div class="qr-hint" id="qrHint"></div>
                    <button type="button" class="qr-link-btn" id="qrRefreshBtn" style="margin-top:12px;" onclick="restartQrLogin()">刷新二维码</button>
                </div>
                <div class="qr-verify-frame" id="qrVerifyFrame">
                    <div class="qr-verify-head">
                        <span>汽水安全验证</span>
                        <button type="button" class="qr-link-btn" onclick="closeQrVerifyFrame()">关闭验证窗口</button>
                    </div>
                    <iframe id="qrVerifyIframe" title="汽水安全验证" sandbox="allow-scripts"></iframe>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeQrLoginModal()">关闭</button>
            </div>
        </div>
    </div>
    <div class="modal" id="tencentVerifyModal">
        <div class="modal-content" style="max-width:460px;max-height:95vh;overflow-y:auto;">
            <div class="modal-header">
                <h3>QQ 音乐滑块验证</h3>
                <button type="button" class="modal-close" aria-label="关闭验证窗口" onclick="closeTencentVerification()">&times;</button>
            </div>
            <div class="modal-body">
                <p id="tencentVerifyModalAccount" class="tencent-verify-message"></p>
                <p id="tencentVerifyStatus" role="status" style="margin-bottom:12px;color:var(--text-secondary);">正在加载官方验证页面…</p>
                <img id="tencentVerifyImage" alt="QQ 音乐验证页面，可在图像上拖动滑块" draggable="false" style="width:400px;max-width:100%;height:auto;touch-action:none;user-select:none;display:block;margin:auto;">
            </div>
            <div class="modal-footer" style="position:sticky;bottom:0;background:var(--bg-card);">
                <button type="button" class="btn btn-default" onclick="closeTencentVerification()">关闭</button>
                <button type="button" class="btn btn-primary" onclick="retryTencentVerification()">完成后重试</button>
            </div>
        </div>
    </div>
    <div class="modal" id="userModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="userModalTitle">添加用户</h3>
                <button class="modal-close" onclick="closeModal('userModal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="userForm">
                    <input type="hidden" id="editUsername">
                    <div class="form-group">
                        <label>用户名</label>
                        <input type="text" id="userUsername" required>
                    </div>
                    <div class="form-group" id="passwordGroup">
                        <label>密码</label>
                        <input type="password" id="userPassword">
                    </div>
                    <div class="form-group">
                        <label>角色</label>
                        <select id="userRole">
                            <option value="user">普通用户</option>
                            <option value="admin">管理员</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('userModal')">取消</button>
                <button type="submit" class="btn btn-primary" id="userSubmitBtn" onclick="document.getElementById('userForm').dispatchEvent(new Event('submit',{cancelable:true}))">保存</button>
            </div>
        </div>
    </div>

    <div class="modal" id="twoFactorSetupModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>🔐 设置双因素认证</h3>
                <button class="modal-close" onclick="closeModal('twoFactorSetupModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div id="twoFactorStep1">
                    <h4 style="margin-bottom:12px;font-size:15px;">第 1 步：扫描二维码</h4>
                    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">使用 Google Authenticator、Authy 或其他 TOTP 认证应用扫描下方二维码。</p>
                    <div style="text-align:center;margin-bottom:16px;">
                        <div id="qrcodeContainer" style="display:inline-block;padding:12px;background:#fff;border:1px solid var(--border);border-radius:var(--radius);"></div>
                    </div>
                    <div class="form-group">
                        <label>手动输入密钥</label>
                        <div style="display:flex;gap:8px;">
                            <input type="text" id="twoFactorSecretDisplay" readonly style="font-family:monospace;font-size:13px;letter-spacing:1px;">
                            <button type="button" class="btn btn-default btn-sm" onclick="copy2FASecret()">复制</button>
                        </div>
                    </div>
                </div>
                <div id="twoFactorStep2" style="display:none;">
                    <h4 style="margin-bottom:12px;font-size:15px;">第 2 步：输入验证码</h4>
                    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">输入认证器应用中显示的 6 位验证码以完成设置。</p>
                    <form id="twoFactorSetupForm">
                        <div class="form-group">
                            <label>验证码</label>
                            <input type="text" id="twoFactorSetupCode" required placeholder="6位数字验证码" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" style="text-align:center;font-size:24px;letter-spacing:8px;font-weight:700;">
                        </div>
                        <div class="error-msg" id="twoFactorSetupError"></div>
                    </form>
                </div>
                <div id="twoFactorStep3" style="display:none;">
                    <h4 style="margin-bottom:12px;font-size:15px;color:var(--success);">✓ 双因素认证已启用</h4>
                    <p style="color:var(--text-secondary);font-size:13px;">您的账户现在受到额外保护，每次登录时都需要输入验证码。</p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" id="twoFactorSetupBack" onclick="twoFactorSetupGoBack()" style="display:none;">上一步</button>
                <button type="button" class="btn btn-primary" id="twoFactorSetupNext" onclick="twoFactorSetupGoNext()">下一步</button>
                <button type="button" class="btn btn-default" id="twoFactorSetupFinish" onclick="closeModal('twoFactorSetupModal')" style="display:none;">完成</button>
            </div>
        </div>
    </div>

    <div class="modal" id="twoFactorDisableModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>禁用双因素认证</h3>
                <button class="modal-close" onclick="closeModal('twoFactorDisableModal')">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">禁用双因素认证会降低账户安全性，请输入密码确认操作。</p>
                <form id="twoFactorDisableForm">
                    <div class="form-group">
                        <label>当前密码</label>
                        <input type="password" id="disable2FAPassword" required placeholder="请输入当前密码">
                    </div>
                    <div class="error-msg" id="disable2FAError"></div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('twoFactorDisableModal')">取消</button>
                <button type="submit" class="btn btn-danger" onclick="document.getElementById('twoFactorDisableForm').dispatchEvent(new Event('submit',{cancelable:true}))">确认禁用</button>
            </div>
        </div>
    </div>

    <div class="modal" id="tokenModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="tokenModalTitle">创建 API Token</h3>
                <button class="modal-close" onclick="closeModal('tokenModal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="tokenForm">
                    <div class="form-group">
                        <label>Token 名称</label>
                        <input type="text" id="tokenName" required placeholder="例如: 自动化脚本">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('tokenModal')">取消</button>
                <button type="submit" class="btn btn-primary" onclick="createToken()">创建</button>
            </div>
        </div>
    </div>

    <div class="modal" id="tokenShowModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>✅ Token 已创建</h3>
                <button class="modal-close" onclick="closeModal('tokenShowModal')">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">请立即复制并妥善保存此 Token，关闭后将无法再次查看完整内容。</p>
                <div class="form-group">
                    <label>Token</label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="createdToken" readonly style="font-family:monospace;font-size:12px;">
                        <button type="button" class="btn btn-primary" onclick="copyCreatedToken()">复制</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>使用示例</label>
                    <pre style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);font-size:11px;overflow-x:auto;">curl -H "Authorization: Bearer &lt;token&gt;" http://your-api/admin/cookies</pre>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="closeModal('tokenShowModal')">我已保存</button>
            </div>
        </div>
    </div>

    <script>
        let authToken = localStorage.getItem('authToken');
        let authUsername = localStorage.getItem('authUsername');

        const api = async (url, options = {}) => {
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            if (authToken) {
                headers['X-Auth-Username'] = authUsername;
                headers['X-Auth-Token'] = authToken;
            }
            const res = await fetch(url, { ...options, headers });
            const data = await res.json();
            if (res.status === 401 && !url.includes('/admin/login')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUsername');
                showLogin();
            }
            return data;
        };

        const showToast = (message, type = 'success') => {
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + type;
            toast.innerHTML = (type === 'success' ? '✓ ' : '✗ ') + message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(20px)';
                toast.style.transition = '0.3s ease';
            }, 2500);
            setTimeout(() => toast.remove(), 3000);
        };

        const formatDate = (timestamp) => {
            if (!timestamp) return '-';
            return new Date(timestamp).toLocaleString('zh-CN');
        };

        const getPlatformName = (platform) => {
            return platform === 'netease' ? '网易云音乐' : platform === 'qishui' ? '汽水音乐' : platform === 'kugou' ? '酷狗音乐' : 'QQ音乐';
        };

        const getValidationBadge = (cookie) => {
            if (cookie.isValid === null || cookie.isValid === undefined) {
                return '<span class="badge badge-warning">未验证</span>';
            } else if (cookie.isValid) {
                const isSvip = Boolean(cookie.userInfo?.isSvip || cookie.userInfo?.canPlaySvip || Number(cookie.userInfo?.svipType) > 0 || String(cookie.userInfo?.vipStage || cookie.userInfo?.vip_stage || '').toLowerCase() === 'svip');
                let vipText = isSvip ? ' SVIP' : (cookie.userInfo?.isVip ? ' VIP' : '');
                return '<span class="badge badge-success">有效' + vipText + '</span>';
            } else {
                return '<span class="badge badge-error">无效</span>';
            }
        };

        const toggleCookieHelp = () => {
            const el = document.getElementById('cookieHelpContent');
            el.classList.toggle('show');
        };

        const showLogin = () => {
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('adminContainer').style.display = 'none';
            document.getElementById('loginBox').style.display = 'block';
            document.getElementById('twoFactorBox').style.display = 'none';
        };

        const showAdmin = () => {
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminContainer').style.display = 'block';
            document.getElementById('currentUser').textContent = authUsername;
            document.getElementById('currentUsernameDisplay').value = authUsername;
            loadDashboard();
            loadConfig();
            load2FAStatus();
        };

        let currentUserRole = 'user';

        const loadConfig = async () => {
            const checkRes = await api('/admin/check');
            if (checkRes?.success) {
                currentUserRole = checkRes.data.role;
                if (currentUserRole !== 'admin') {
                    document.getElementById('adminPathSection').style.display = 'none';
                    return;
                }
            }
            const res = await api('/admin/config');
            if (res?.success) {
                if (res.data?.adminPath) {
                    document.getElementById('adminPathInput').value = res.data.adminPath;
                }
                document.getElementById('qishuiSignerUrl').value = res.data?.qishuiSignerUrl || '';
                document.getElementById('loudnessServiceUrl').value = res.data?.loudnessServiceUrl || '';
            }
        };

        const logout = async () => {
            await api('/admin/logout', { method: 'POST' });
            localStorage.removeItem('authToken');
            localStorage.removeItem('authUsername');
            showLogin();
        };

        const switchSection = (section) => {
            document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-section="' + section + '"]').classList.add('active');
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(section + 'Section').classList.add('active');
            const titles = { dashboard: '仪表盘', cookies: 'Cookie管理', monitor: 'Cookie监测', tokens: 'API Token', users: '用户管理', logs: '操作日志', settings: '设置' };
            document.getElementById('pageTitle').textContent = titles[section];
            if (section === 'cookies') loadCookies();
            if (section === 'users') loadUsers();
            if (section === 'logs') loadLogs();
            if (section === 'monitor') loadMonitor();
            if (section === 'tokens') loadTokens();
        };

        const loadDashboard = async () => {
            const [cookiesRes, usersRes, logsRes] = await Promise.all([
                api('/admin/cookies'),
                api('/admin/users'),
                api('/admin/logs?limit=5')
            ]);
            if (cookiesRes?.success) {
                document.getElementById('totalCookies').textContent = cookiesRes.data.length;
                document.getElementById('validCookies').textContent = cookiesRes.data.filter(c => c.isValid === true).length;
            }
            if (usersRes?.success) {
                document.getElementById('totalUsers').textContent = usersRes.data.length;
            }
            if (logsRes?.success) {
                document.getElementById('totalLogs').textContent = logsRes.data.length;
                const tbody = document.getElementById('recentLogs');
                tbody.innerHTML = logsRes.data.slice(0, 5).map(log => '<tr><td>' + formatDate(log.timestamp) + '</td><td>' + log.action + '</td><td>' + log.details + '</td><td>' + log.username + '</td></tr>').join('');
            }
        };

        const loadCookies = async () => {
            loadTencentVerifications();
            const res = await api('/admin/cookies');
            if (!res?.success) return;
            const tbody = document.getElementById('cookiesList');
            if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">🍪</div><div class="empty-state-text">暂无Cookie数据</div></td></tr>';
                return;
            }
            tbody.innerHTML = res.data.map(cookie => {
                let vipAbilityText = '';
                if (cookie.userInfo) {
                    if (cookie.userInfo.canPlayVip) {
                        vipAbilityText = '<span style="color:var(--success);">✓ 可播放VIP音乐</span>';
                    } else {
                        vipAbilityText = '<span style="color:var(--danger);">✗ 不可播放VIP音乐</span>';
                    }
                }
                return '<tr>' +
                    '<td><span class="badge badge-primary">' + getPlatformName(cookie.platform) + '</span></td>' +
                    '<td class="cookie-preview" title="' + (cookie.cookiePreview || '') + '">' + (cookie.cookiePreview || '-') + '</td>' +
                    '<td>' + (cookie.note || '-') + '</td>' +
                    '<td><div class="validation-status">' + getValidationBadge(cookie) + '</div>' +
                    (vipAbilityText ? '<div class="user-info-tooltip">' + vipAbilityText + '</div>' : '') +
                    '<div class="user-info-tooltip cookie-error-counts"><span class="url-error-count">URL 获取失败：' + (cookie.urlErrorCount || 0) + ' 次</span>' +
                    (cookie.platform === 'tencent' ? '<span class="slider-error-count">滑块：' + (cookie.tencentSliderCount || 0) + ' 次</span>' : '') + '</div>' +
                    (cookie.validationError ? '<div style="color:var(--danger);font-size:11px;">' + cookie.validationError + '</div>' : '') + '</td>' +
                    '<td>' + (cookie.isActive ? '<span class="status-dot status-active"></span>启用' : '<span class="status-dot status-inactive"></span>禁用') + '</td>' +
                    '<td>' + formatDate(cookie.createdAt) + '</td>' +
                        '<td class="actions">' +
                        '<button class="btn btn-success btn-sm" onclick="verifyCookie(\\'' + cookie.id + '\\')">验证</button>' +
                        '<button class="btn btn-default btn-sm" onclick="setFmPriority(\\'' + cookie.platform + '\\',\\'' + cookie.id + '\\')">' + (cookie.fmPriority ? '取消FM优先' : '设为FM优先') + '</button>' +
                        (cookie.platform === 'tencent' ? '<button class="btn btn-warning btn-sm" onclick="refreshCookie(\\'' + cookie.id + '\\')">刷新</button>' : '') +
                        '<button class="btn btn-default btn-sm" onclick="editCookie(\\'' + cookie.id + '\\')">编辑</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="deleteCookie(\\'' + cookie.id + '\\')">删除</button>' +
                    '</td></tr>';
            }).join('');
        };

        let tencentVerificationId = '';
        let tencentVerifications = [];
        let tencentVerifyOpening = false;
        let tencentVerifyTimer = null;
        let tencentVerifyImageUrl = '';
        let tencentVerifyBusy = false;
        let lastTencentPointerMove = 0;
        let tencentPointerQueue = Promise.resolve();
        const selectTencentVerification = (id) => {
            const pending = tencentVerifications.find(account => account.id === id);
            const changed = tencentVerificationId !== (pending?.id || '');
            tencentVerificationId = pending?.id || '';
            if (!pending) return;
            document.getElementById('tencentVerifyAccountSelect').value = pending.id;
            document.getElementById('tencentVerifyHeading').textContent = pending.confirmed ? 'QQ 音乐需要滑块验证' : 'QQ 音乐 URL 多次获取失败，可能需要验证';
            document.getElementById('tencentVerifyAccount').textContent = pending.note || pending.nickname || '未备注账号';
            const identity = [pending.nickname, pending.accountId ? 'QQ / 微信账号 ' + pending.accountId : '', '记录 ' + pending.id].filter(Boolean).join(' · ');
            document.getElementById('tencentVerifyIdentity').textContent = identity;
            document.getElementById('tencentVerifyModalAccount').textContent = (pending.note || pending.nickname || '未备注账号') + ' · ' + identity;
            document.getElementById('tencentVerifyMessage').textContent = pending.songmid ? '歌曲 ' + pending.songmid + (pending.confirmed ? ' 触发滑块验证。' : ' 获取失败，请先检查歌曲权限或尝试验证。') : '旧记录未保存歌曲 ID，请填写一首播放失败的歌曲。';
            document.getElementById('tencentVerifyFailures').textContent = (pending.urlErrorCount || 0) + ' 次';
            document.getElementById('tencentVerifySliders').textContent = (pending.tencentSliderCount || 0) + ' 次';
            const remaining = Number(pending.tencentCooldownUntil || 0) - Date.now();
            const cooldown = document.getElementById('tencentVerifyCooldown');
            cooldown.textContent = remaining > 0 ? '剩余 ' + Math.ceil(remaining / 60000) + ' 分钟' : '未在冷却';
            cooldown.title = remaining > 0 ? '恢复时间：' + formatDate(pending.tencentCooldownUntil) : '';
            document.getElementById('tencentVerifySongGroup').style.display = pending.songmid ? 'none' : 'block';
            if (changed) document.getElementById('tencentVerifySongmid').value = '';
        };
        const loadTencentVerifications = async () => {
            if (tencentVerifyOpening || document.getElementById('tencentVerifyModal').classList.contains('show')) return;
            const res = await api('/admin/cookies/tencent-verifications');
            if (!res?.success || tencentVerifyOpening || document.getElementById('tencentVerifyModal').classList.contains('show')) return;
            tencentVerifications = res.data || [];
            document.getElementById('tencentVerifyBanner').style.display = tencentVerifications.length ? 'block' : 'none';
            document.getElementById('tencentVerifyCount').textContent = tencentVerifications.length + ' 个账号待处理';
            const selector = document.getElementById('tencentVerifyAccountSelect');
            selector.replaceChildren(...tencentVerifications.map(account => {
                const option = document.createElement('option');
                option.value = account.id;
                option.textContent = (account.note || account.nickname || '未备注账号') + ' · ' + (account.accountId || account.id);
                return option;
            }));
            selectTencentVerification(tencentVerifications.some(account => account.id === tencentVerificationId) ? tencentVerificationId : tencentVerifications[0]?.id);
        };

        const refreshTencentVerificationFrame = async () => {
            if (!tencentVerificationId || tencentVerifyBusy || !document.getElementById('tencentVerifyModal').classList.contains('show')) return;
            tencentVerifyBusy = true;
            try {
                const response = await fetch('/admin/cookies/' + encodeURIComponent(tencentVerificationId) + '/verification/frame', {
                    headers: { 'X-Auth-Username': authUsername, 'X-Auth-Token': authToken },
                    cache: 'no-store',
                });
                if (!response.ok) throw new Error('验证窗口已关闭，请重新打开');
                const imageUrl = URL.createObjectURL(await response.blob());
                if (!document.getElementById('tencentVerifyModal').classList.contains('show')) { URL.revokeObjectURL(imageUrl); return; }
                document.getElementById('tencentVerifyImage').src = imageUrl;
                if (tencentVerifyImageUrl) URL.revokeObjectURL(tencentVerifyImageUrl);
                tencentVerifyImageUrl = imageUrl;
                document.getElementById('tencentVerifyStatus').textContent = '请在下方画面中拖动滑块；完成后点击“完成后重试”。';
            } catch (error) {
                document.getElementById('tencentVerifyStatus').textContent = error.message;
                clearInterval(tencentVerifyTimer);
                tencentVerifyTimer = null;
            } finally {
                tencentVerifyBusy = false;
            }
        };

        const openTencentVerification = async () => {
            if (!tencentVerificationId || tencentVerifyOpening) return;
            tencentVerifyOpening = true;
            const button = document.getElementById('tencentVerifyOpen');
            button.disabled = true;
            document.getElementById('tencentVerifyAccountSelect').disabled = true;
            try {
                document.getElementById('tencentVerifyStatus').textContent = '正在加载官方验证页面…';
                const songmid = document.getElementById('tencentVerifySongmid').value.trim();
                const res = await api('/admin/cookies/' + encodeURIComponent(tencentVerificationId) + '/verification/start', { method: 'POST', body: JSON.stringify({ songmid }) });
                if (!res?.success) { showToast(res?.error || '验证窗口打开失败', 'error'); return; }
                document.getElementById('tencentVerifyModal').classList.add('show');
                await refreshTencentVerificationFrame();
                clearInterval(tencentVerifyTimer);
                tencentVerifyTimer = setInterval(refreshTencentVerificationFrame, 650);
            } catch {
                showToast('验证窗口打开失败，请稍后重试', 'error');
            } finally {
                tencentVerifyOpening = false;
                button.disabled = false;
                document.getElementById('tencentVerifyAccountSelect').disabled = false;
            }
        };

        const closeTencentVerification = async () => {
            clearInterval(tencentVerifyTimer);
            tencentVerifyTimer = null;
            document.getElementById('tencentVerifyModal').classList.remove('show');
            document.getElementById('tencentVerifyImage').removeAttribute('src');
            if (tencentVerifyImageUrl) URL.revokeObjectURL(tencentVerifyImageUrl);
            tencentVerifyImageUrl = '';
            if (tencentVerificationId) await api('/admin/cookies/' + encodeURIComponent(tencentVerificationId) + '/verification/close', { method: 'POST' });
        };

        const tencentVerifyImage = document.getElementById('tencentVerifyImage');
        const sendTencentPointer = (type, event) => {
            const id = tencentVerificationId;
            if (!id) return;
            const bounds = tencentVerifyImage.getBoundingClientRect();
            const position = { type, x: (event.clientX - bounds.left) * 400 / bounds.width, y: (event.clientY - bounds.top) * 720 / bounds.height };
            tencentPointerQueue = tencentPointerQueue.catch(() => {}).then(() => api('/admin/cookies/' + encodeURIComponent(id) + '/verification/pointer', {
                method: 'POST', body: JSON.stringify(position),
            }));
        };
        tencentVerifyImage.addEventListener('pointerdown', event => {
            event.preventDefault();
            tencentVerifyImage.setPointerCapture(event.pointerId);
            sendTencentPointer('down', event);
        });
        tencentVerifyImage.addEventListener('pointermove', event => {
            if (event.buttons & 1 && Date.now() - lastTencentPointerMove > 40) {
                lastTencentPointerMove = Date.now();
                sendTencentPointer('move', event);
            }
        });
        tencentVerifyImage.addEventListener('pointerup', event => sendTencentPointer('up', event));
        tencentVerifyImage.addEventListener('pointercancel', event => sendTencentPointer('up', event));

        const retryTencentVerification = async () => {
            if (!tencentVerificationId) return;
            const button = document.getElementById('tencentVerifyRetry');
            button.disabled = true;
            try {
                const res = await api('/admin/cookies/' + encodeURIComponent(tencentVerificationId) + '/retry-play', { method: 'POST' });
                showToast(res?.success ? '验证已生效，请重新播放歌曲' : (res?.error || '重试失败'), res?.success ? 'success' : 'error');
                if (res?.success && document.getElementById('tencentVerifyModal').classList.contains('show')) await closeTencentVerification();
                await loadCookies();
            } finally {
                button.disabled = false;
            }
        };

        setInterval(() => {
            if (authToken && document.getElementById('cookiesSection').classList.contains('active')) loadTencentVerifications();
        }, 5000);

        const loadUsers = async () => {
            const res = await api('/admin/users');
            if (!res?.success) return;
            const tbody = document.getElementById('usersList');
            tbody.innerHTML = res.data.map(user => '<tr><td>' + user.username + '</td><td><span class="badge ' + (user.role === 'admin' ? 'badge-warning' : 'badge-success') + '">' + (user.role === 'admin' ? '管理员' : '普通用户') + '</span></td><td>' + formatDate(user.createdAt) + '</td><td>' + formatDate(user.lastLogin) + '</td><td class="actions"><button class="btn btn-default btn-sm" onclick="editUser(\\'' + user.username + '\\')">编辑</button>' + (user.username !== 'admin' ? '<button class="btn btn-danger btn-sm" onclick="deleteUser(\\'' + user.username + '\\')">删除</button>' : '') + '</td></tr>').join('');
        };

        const loadLogs = async () => {
            const res = await api('/admin/logs?limit=100');
            if (!res?.success) return;
            const tbody = document.getElementById('logsList');
            tbody.innerHTML = res.data.map(log => '<tr><td>' + formatDate(log.timestamp) + '</td><td>' + log.action + '</td><td>' + log.details + '</td><td>' + log.username + '</td></tr>').join('');
        };

        const loadTokens = async () => {
            const res = await api('/admin/tokens');
            if (!res?.success) return;
            const tbody = document.getElementById('tokensList');
            if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">🔑</div><div class="empty-state-text">暂无 API Token</div></td></tr>';
            } else {
                tbody.innerHTML = res.data.map(token => {
                    const tokenPreview = token.id.substring(0, 8) + '...';
                    return '<tr>' +
                        '<td>' + token.name + '</td>' +
                        '<td><code style="font-size:11px;color:var(--text-muted);">' + tokenPreview + '</code></td>' +
                        '<td>' + formatDate(token.createdAt) + '</td>' +
                        '<td>' + (token.lastUsedAt ? formatDate(token.lastUsedAt) : '-') + '</td>' +
                        '<td>' + (token.usageCount || 0) + '</td>' +
                        '<td class="actions">' +
                            '<button class="btn btn-danger btn-sm" onclick="deleteToken(\\'' + token.id + '\\',\\'' + token.name + '\\')">删除</button>' +
                        '</td></tr>';
                }).join('');
            }
        };

        const showTokenModal = () => {
            document.getElementById('tokenForm').reset();
            document.getElementById('tokenModal').classList.add('show');
        };

        const createToken = async () => {
            const name = document.getElementById('tokenName').value.trim();
            if (!name) {
                showToast('请输入 Token 名称', 'error');
                return;
            }
            const res = await api('/admin/tokens', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            if (res?.success) {
                closeModal('tokenModal');
                document.getElementById('createdToken').value = res.data.token;
                document.getElementById('tokenShowModal').classList.add('show');
                loadTokens();
            } else {
                showToast(res?.error || '创建失败', 'error');
            }
        };

        const copyCreatedToken = () => {
            const token = document.getElementById('createdToken').value;
            navigator.clipboard.writeText(token).then(() => showToast('已复制到剪贴板'));
        };

        const deleteToken = async (id, name) => {
            if (!confirm('确定要删除 Token "' + name + '" 吗？删除后使用该 Token 的应用将无法访问 API。')) return;
            const res = await api('/admin/tokens/' + id, { method: 'DELETE' });
            if (res?.success) {
                showToast('Token 已删除');
                loadTokens();
            } else {
                showToast(res?.error || '删除失败', 'error');
            }
        };

        const loadMonitor = async () => {
            const [statusRes, configRes, webhookRes, logsRes] = await Promise.all([
                api('/admin/monitor/status'),
                api('/admin/monitor'),
                api('/admin/webhook'),
                api('/admin/monitor/logs?limit=50')
            ]);
            if (statusRes?.success) {
                const status = statusRes.data;
                document.getElementById('monitorStatus').textContent = status.isRunning ? '运行中' : '已停止';
                document.getElementById('monitorStatus').style.color = status.isRunning ? 'var(--success)' : 'var(--danger)';
                document.getElementById('monitorCheckCount').textContent = status.checkCount || 0;
                document.getElementById('monitorLastCheck').textContent = status.lastCheckTime ? formatDate(status.lastCheckTime) : '-';
            }
            if (configRes?.success) {
                document.getElementById('monitorEnabled').checked = configRes.data.enabled;
                document.getElementById('monitorInterval').textContent = configRes.data.interval;
                document.getElementById('monitorIntervalInput').value = configRes.data.interval;
            }
            if (webhookRes?.success) {
                document.getElementById('webhookEnabled').checked = webhookRes.data.enabled;
                document.getElementById('webhookUrl').value = webhookRes.data.url || '';
                if (webhookRes.data.contentType) {
                    document.getElementById('webhookContentType').value = webhookRes.data.contentType;
                }
                if (webhookRes.data.headers && Object.keys(webhookRes.data.headers).length > 0) {
                    document.getElementById('webhookHeaders').value = JSON.stringify(webhookRes.data.headers, null, 2);
                }
                if (webhookRes.data.bodyTemplate) {
                    document.getElementById('webhookBodyTemplate').value = webhookRes.data.bodyTemplate;
                }
            }
            if (logsRes?.success) {
                const tbody = document.getElementById('monitorLogsList');
                if (logsRes.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-icon">🔔</div><div class="empty-state-text">暂无监测记录</div></td></tr>';
                } else {
                    tbody.innerHTML = logsRes.data.map(log => {
                        let typeText = '', typeClass = '';
                        switch(log.type) {
                            case 'check_complete': typeText = '检查完成'; typeClass = 'badge-success'; break;
                            case 'check_error': typeText = '检查错误'; typeClass = 'badge-error'; break;
                            case 'cookie_invalid': typeText = 'Cookie失效'; typeClass = 'badge-error'; break;
                            case 'cookie_refreshed': typeText = 'Cookie刷新'; typeClass = 'badge-success'; break;
                            case 'vip_lost': typeText = 'VIP丢失'; typeClass = 'badge-warning'; break;
                            case 'vip_unavailable': typeText = '无VIP'; typeClass = 'badge-warning'; break;
                            case 'webhook_sent': typeText = '通知发送'; typeClass = log.success ? 'badge-success' : 'badge-error'; break;
                            case 'webhook_error': typeText = '通知失败'; typeClass = 'badge-error'; break;
                            default: typeText = log.type; typeClass = 'badge-info';
                        }
                        let details = '';
                        if (log.type === 'check_complete') details = '检查了 ' + log.totalChecked + ' 个Cookie';
                        else if (log.type === 'cookie_invalid') details = log.platformName + ': ' + (log.note || log.cookieId) + ' - ' + log.reason;
                        else if (log.type === 'cookie_refreshed') details = log.platformName + ': ' + (log.note || log.cookieId) + ' - ' + log.result;
                        else if (log.type === 'vip_lost') details = log.platformName + ': ' + (log.note || log.cookieId) + ' - ' + log.reason;
                        else if (log.type === 'vip_unavailable') details = log.platformName + ': ' + (log.note || log.cookieId) + ' - ' + log.reason;
                        else if (log.type === 'webhook_sent') details = '状态码: ' + log.statusCode;
                        else if (log.error) details = log.error;
                        return '<tr><td>' + formatDate(log.timestamp) + '</td><td><span class="badge ' + typeClass + '">' + typeText + '</span></td><td>' + details + '</td></tr>';
                    }).join('');
                }
            }
        };

        const checkNow = async () => {
            showToast('正在检查Cookie...', 'success');
            const res = await api('/admin/monitor/check', { method: 'POST' });
            if (res?.success) { showToast('检查完成'); loadMonitor(); }
            else showToast(res?.error || '检查失败', 'error');
        };

        const testWebhook = async () => {
            showToast('正在发送测试消息...', 'success');
            const res = await api('/admin/webhook/test', { method: 'POST' });
            if (res?.success) showToast('测试消息已发送');
            else showToast(res?.error || '发送失败', 'error');
        };

        // ===== 扫码登录（四平台统一）=====
        const QR_PLATFORMS = {
            netease: {
                label: '网易云音乐',
                note: '网易云扫码登录',
                instruction: '请使用网易云音乐 App 扫码',
                waiting: '等待网易云音乐 App 扫码…',
                scanHint: '扫码后请在手机上确认登录',
                hint: '登录凭证仅用于获取歌曲与歌词，保存在本机数据目录中。',
            },
            tencent: {
                label: 'QQ 音乐',
                note: 'QQ音乐扫码登录',
                instruction: '请使用 QQ 音乐 App 扫码',
                waiting: '等待 QQ 音乐 App 扫码…',
                scanHint: '已扫码，请在 QQ 音乐 App 上确认',
                hint: 'App 扫码会携带设备指纹，可自动续期并稳定识别会员权益；授权换 Cookie 较慢，请耐心等待。',
            },
            kugou: {
                label: '酷狗音乐',
                note: '酷狗扫码登录',
                instruction: '请使用酷狗音乐 App 扫码',
                waiting: '等待酷狗音乐 App 扫码…',
                scanHint: '已扫码，请在酷狗音乐 App 上确认',
                hint: '扫码后将保存 token、userid 及设备标识，用于 VIP 音质校验。',
            },
            qishui: {
                label: '汽水音乐',
                note: '汽水扫码登录',
                instruction: '请使用已登录的汽水音乐 App 扫码',
                waiting: '等待汽水音乐 App 扫码…',
                scanHint: '已扫码，请在汽水音乐 App 上确认',
                hint: '汽水需要本机 Chrome/Chromium 生成签名；若触发安全验证，弹窗内会显示验证窗口。',
            },
        };

        let qrPlatform = 'netease';
        let qrSessionKey = '';
        let qrPollTimer = null;
        let qrBusy = false;
        let qrRunId = 0;
        let qrPhase = 'waiting';
        let qrVerifySubmitted = false;

        const qrEl = (id) => document.getElementById(id);

        const setQrDot = (platform, state) => {
            const tab = document.querySelector('.qr-platform-tab[data-platform="' + platform + '"]');
            if (!tab) return;
            const dot = tab.querySelector('.qr-tab-dot');
            if (dot) dot.className = 'qr-tab-dot' + (state ? ' ' + state : '');
        };

        const renderQrTabs = () => {
            document.querySelectorAll('.qr-platform-tab').forEach(tab => {
                const platform = tab.getAttribute('data-platform');
                const active = platform === qrPlatform;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
                tab.disabled = qrBusy && !active;
            });
        };

        const setQrStatus = (text, kind = '') => {
            const el = qrEl('qrStatus');
            el.textContent = text || '';
            el.className = 'qr-status' + (kind ? ' ' + kind : '');
        };

        // 后端部分平台会把上游英文状态（如 "success"）原样放在 message 里，
        // 直接展示可读性差，这里只接受含中文的提示。
        const preferMessage = (message, fallback) => {
            const text = String(message || '').trim();
            return /[\u4e00-\u9fa5]/.test(text) ? text : fallback;
        };

        const showQrPlaceholder = (text) => {
            qrEl('qrImage').style.display = 'none';
            qrEl('qrOverlay').style.display = 'none';
            const holder = qrEl('qrPlaceholder');
            holder.style.display = 'flex';
            holder.querySelector('span').textContent = text || '正在生成二维码…';
        };

        const showQrImage = (src) => {
            qrEl('qrPlaceholder').style.display = 'none';
            qrEl('qrOverlay').style.display = 'none';
            const image = qrEl('qrImage');
            image.src = src;
            image.style.display = 'block';
        };

        const showQrOverlay = (text, expired = false) => {
            qrEl('qrPlaceholder').style.display = 'none';
            qrEl('qrImage').style.display = 'none';
            const overlay = qrEl('qrOverlay');
            overlay.className = 'qr-overlay' + (expired ? ' expired' : '');
            overlay.innerHTML = (expired ? '<div class="qr-expired-icon"></div>' : '') + '<div>' + text + '</div>';
            overlay.style.display = 'flex';
        };

        const stopQrPolling = () => {
            if (qrPollTimer) clearInterval(qrPollTimer);
            qrPollTimer = null;
        };

        const closeQrVerifyFrame = () => {
            const frame = qrEl('qrVerifyFrame');
            frame.classList.remove('show');
            qrEl('qrVerifyIframe').src = 'about:blank';
        };

        const openQrVerifyFrame = (key) => {
            // security_host.html 把 bridgeRoot 当作路径前缀拼接：
            // bridgeRoot + /start、/request、/complete，
            // 因此这里传 /admin/qr/qishui/verify，对齐后端三条代理路由。
            const url = '/admin/qr/qishui/security/security_host.html'
                + '?key=' + encodeURIComponent(key)
                + '&bridgeRoot=' + encodeURIComponent('/admin/qr/qishui/verify');
            qrEl('qrVerifyIframe').src = url;
            qrEl('qrVerifyFrame').classList.add('show');
        };

        const resetQrVerify = () => {
            qrVerifySubmitted = false;
            closeQrVerifyFrame();
        };

        const applyQrPlatformChrome = () => {
            const meta = QR_PLATFORMS[qrPlatform];
            qrEl('qrInstruction').textContent = meta.instruction;
            qrEl('qrHint').textContent = meta.hint;
        };

        const finishQrLogin = async (platform, cookie) => {
            const runId = qrRunId;
            const meta = QR_PLATFORMS[platform];
            stopQrPolling();
            setQrStatus('授权成功，正在保存凭证…', 'success');
            setQrDot(platform, 'busy');
            const save = await api('/admin/cookies', {
                method: 'POST',
                body: JSON.stringify({ platform, cookie, note: meta.note, isActive: true }),
            });
            // 保存期间用户可能已切换平台或关闭弹窗，此时不能再用旧结果改写界面。
            if (runId !== qrRunId || platform !== qrPlatform) return;
            if (save?.success) {
                setQrDot(platform, 'ok');
                showToast(meta.label + ' Cookie 已保存并验证', 'success');
                const warn = save.data?.validationError;
                if (warn) showToast('已保存，但验证未通过：' + warn, 'error');
                closeQrLoginModal();
                loadCookies();
                loadDashboard();
            } else {
                setQrDot(platform, 'err');
                setQrStatus(save?.error || '登录成功，但保存 Cookie 失败', 'error');
            }
        };

        const pollQrLogin = async () => {
            const runId = qrRunId;
            const platform = qrPlatform;
            if (!qrSessionKey || qrBusy) return;
            qrBusy = true;
            let result;
            try {
                result = await api('/admin/qr/check', {
                    method: 'POST',
                    body: JSON.stringify({ platform, key: qrSessionKey, qrsig: qrSessionKey }),
                });
            } finally {
                qrBusy = false;
            }
            if (runId !== qrRunId || platform !== qrPlatform) return;
            if (!result?.success) {
                stopQrPolling();
                setQrDot(platform, 'err');
                setQrStatus(result?.error || '扫码状态查询失败', 'error');
                showQrOverlay('状态查询失败', true);
                return;
            }

            const meta = QR_PLATFORMS[platform];
            const data = result.data || {};
            const status = String(data.status || '').toLowerCase();

            if (status === 'confirmed') {
                resetQrVerify();
                await finishQrLogin(platform, data.cookie);
                return;
            }

            if (status === 'second_verify') {
                qrPhase = 'scanned';
                setQrDot(platform, 'busy');
                setQrStatus(qrVerifySubmitted ? '汽水验证中，请稍候…' : '请在弹出的验证窗口完成身份验证');
                if (!qrEl('qrVerifyFrame').classList.contains('show')) openQrVerifyFrame(qrSessionKey);
                return;
            }

            if (status === 'expired') {
                stopQrPolling();
                setQrDot(platform, 'err');
                setQrStatus(preferMessage(data.message, '二维码已过期，请刷新'), 'error');
                showQrOverlay(preferMessage(data.message, '二维码已过期'), true);
                return;
            }

            if (status === 'error') {
                stopQrPolling();
                setQrDot(platform, 'err');
                setQrStatus(preferMessage(data.message, '扫码异常'), 'error');
                showQrOverlay('扫码失败', true);
                return;
            }

            if (status === 'scanned') {
                qrPhase = 'scanned';
                setQrDot(platform, 'busy');
                setQrStatus(preferMessage(data.message, meta.scanHint));
                return;
            }

            // waiting：已扫过就不要把文案打回“等待扫码”
            if (qrPhase !== 'scanned') {
                setQrStatus(preferMessage(data.message, meta.waiting));
            }
        };

        const startQrLogin = async () => {
            const runId = ++qrRunId;
            const platform = qrPlatform;
            const meta = QR_PLATFORMS[platform];
            stopQrPolling();
            resetQrVerify();

            qrSessionKey = '';
            qrPhase = 'waiting';
            qrBusy = false;
            applyQrPlatformChrome();
            renderQrTabs();
            setQrDot(platform, 'busy');
            showQrPlaceholder('正在生成二维码…');
            setQrStatus('正在初始化…');

            const res = await api('/admin/qr/create', {
                method: 'POST',
                body: JSON.stringify({ platform }),
            });
            if (runId !== qrRunId || platform !== qrPlatform) return;

            const data = res?.data || {};
            const image = data.qrimg
                || (data.qrurl ? 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(data.qrurl) : '');
            const key = data.key || data.token || data.qrsig || '';

            if (!res?.success || !key || !image) {
                setQrDot(platform, 'err');
                showQrOverlay('二维码生成失败', true);
                setQrStatus(res?.error || '二维码生成失败', 'error');
                return;
            }

            qrSessionKey = key;
            showQrImage(image);
            setQrStatus(preferMessage(data.message, meta.waiting));
            qrPollTimer = setInterval(pollQrLogin, platform === 'qishui' ? 3000 : 2000);
            await pollQrLogin();
        };

        const restartQrLogin = () => { startQrLogin(); };

        const switchQrPlatform = (platform) => {
            if (!QR_PLATFORMS[platform] || platform === qrPlatform) return;
            qrPlatform = platform;
            startQrLogin();
        };

        const handleQrVerifyMessage = (event) => {
            // sandbox="allow-scripts" 的 iframe 是 opaque origin，
            // event.origin 会是字符串 "null"，不能与 location.origin 比较；
            // 因此以 event.source 严格对应到验证 iframe 为准。
            if (event.data?.type !== 'qishui-second-verify-complete') return;
            if (event.source !== qrEl('qrVerifyIframe').contentWindow) return;
            qrVerifySubmitted = true;
            setQrStatus('验证已提交，正在确认登录…');
            pollQrLogin();
        };
        window.addEventListener('message', handleQrVerifyMessage);

        const closeQrLoginModal = () => {
            qrRunId += 1;
            stopQrPolling();
            qrSessionKey = '';
            qrBusy = false;
            resetQrVerify();
            closeModal('qrLoginModal');
        };

        const showQrLoginModal = () => {
            qrEl('qrLoginModal').classList.add('show');
            startQrLogin();
        };
        const showAddCookieModal = () => {
            document.getElementById('cookieModalTitle').textContent = '添加Cookie';
            document.getElementById('cookieForm').reset();
            document.getElementById('cookieId').value = '';
            document.getElementById('cookieActive').checked = true;
            document.getElementById('skipValidation').checked = false;
            document.getElementById('cookieSubmitBtn').disabled = false;
            document.getElementById('cookieSubmitBtn').textContent = '保存并验证';
            document.getElementById('cookieHelpContent').classList.remove('show');
            document.getElementById('cookieModal').classList.add('show');
        };

        const editCookie = async (id) => {
            const res = await api('/admin/cookies/' + id);
            if (!res?.success) return;
            document.getElementById('cookieModalTitle').textContent = '编辑Cookie';
            document.getElementById('cookieId').value = res.data.id;
            document.getElementById('cookiePlatform').value = res.data.platform;
            document.getElementById('cookieNote').value = res.data.note || '';
            document.getElementById('cookieActive').checked = res.data.isActive;
            document.getElementById('skipValidation').checked = false;
            document.getElementById('cookieSubmitBtn').disabled = false;
            document.getElementById('cookieSubmitBtn').textContent = '保存';
            document.getElementById('cookieHelpContent').classList.remove('show');
            document.getElementById('cookieModal').classList.add('show');
        };

        const verifyCookie = async (id) => {
            showToast('正在验证Cookie...', 'success');
            const res = await api('/admin/cookies/' + id + '/verify', { method: 'POST' });
            if (res?.success) {
                if (res.data.isValid) {
                    let msg = 'Cookie验证有效';
                    const isSvip = Boolean(res.data.userInfo?.isSvip || res.data.userInfo?.canPlaySvip || Number(res.data.userInfo?.svipType) > 0 || String(res.data.userInfo?.vipStage || res.data.userInfo?.vip_stage || '').toLowerCase() === 'svip');
                    if (isSvip) msg += ' - 可播放SVIP音乐';
                    else if (res.data.userInfo?.canPlayVip !== undefined) msg += res.data.userInfo.canPlayVip ? ' - 可播放VIP音乐' : ' - 不可播放VIP音乐';
                    showToast(msg, 'success');
                } else showToast('Cookie验证失败: ' + (res.data.validationError || '无效'), 'error');
                loadCookies(); loadDashboard();
            } else showToast(res?.error || '验证失败', 'error');
        };

        const setFmPriority = async (platform, cookieId) => {
            const cookie = (await api('/admin/cookies?platform=' + encodeURIComponent(platform)))?.data?.find(item => item.id === cookieId);
            const res = await api('/admin/config/fm-priority', { method: 'PUT', body: JSON.stringify({ platform, cookieId: cookie?.fmPriority ? '' : cookieId }) });
            if (res?.success) { showToast(cookie?.fmPriority ? '已取消FM优先' : '已设为FM优先'); loadCookies(); }
            else showToast(res?.error || '设置FM优先失败', 'error');
        };

        const refreshCookie = async (id) => {
            showToast('正在刷新Cookie...', 'success');
            const res = await api('/admin/cookies/' + id + '/refresh', { method: 'POST' });
            if (res?.success) {
                showToast('Cookie刷新成功');
                loadCookies(); loadDashboard();
            } else showToast(res?.error || '刷新失败', 'error');
        };

        const deleteCookie = async (id) => {
            if (!confirm('确定要删除这个Cookie吗？')) return;
            const res = await api('/admin/cookies/' + id, { method: 'DELETE' });
            if (res?.success) { showToast('Cookie已删除'); loadCookies(); loadDashboard(); }
            else showToast(res?.error || '删除失败', 'error');
        };

        const showAddUserModal = () => {
            document.getElementById('userModalTitle').textContent = '添加用户';
            document.getElementById('userForm').reset();
            document.getElementById('editUsername').value = '';
            document.getElementById('userUsername').disabled = false;
            document.getElementById('passwordGroup').style.display = 'block';
            document.getElementById('userPassword').required = true;
            document.getElementById('userModal').classList.add('show');
        };

        const editUser = (username) => {
            document.getElementById('userModalTitle').textContent = '编辑用户';
            document.getElementById('editUsername').value = username;
            document.getElementById('userUsername').value = username;
            document.getElementById('userUsername').disabled = true;
            document.getElementById('passwordGroup').style.display = 'block';
            document.getElementById('userPassword').required = false;
            document.getElementById('userPassword').placeholder = '留空则不修改密码';
            document.getElementById('userModal').classList.add('show');
        };

        const deleteUser = async (username) => {
            if (!confirm('确定要删除用户 ' + username + ' 吗？')) return;
            const res = await api('/admin/users/' + username, { method: 'DELETE' });
            if (res?.success) { showToast('用户已删除'); loadUsers(); }
            else showToast(res?.error || '删除失败', 'error');
        };

        const closeModal = (id) => {
            document.getElementById(id).classList.remove('show');
        };

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const res = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
            if (res?.require2FA) {
                document.getElementById('loginBox').style.display = 'none';
                document.getElementById('twoFactorBox').style.display = 'block';
                document.getElementById('twoFactorUsername').value = username;
                document.getElementById('twoFactorCode').value = '';
                document.getElementById('twoFactorError').textContent = '';
                document.getElementById('twoFactorCode').focus();
            } else if (res?.success) {
                authToken = res.data.token; authUsername = res.data.username;
                localStorage.setItem('authToken', authToken); localStorage.setItem('authUsername', authUsername);
                showAdmin();
            } else document.getElementById('loginError').textContent = res?.error || '登录失败';
        });

        document.getElementById('twoFactorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('twoFactorUsername').value;
            const code = document.getElementById('twoFactorCode').value.trim();
            if (!code) { document.getElementById('twoFactorError').textContent = '请输入验证码'; return; }
            const res = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password: document.getElementById('loginPassword').value, code }) });
            if (res?.success) {
                authToken = res.data.token; authUsername = res.data.username;
                localStorage.setItem('authToken', authToken); localStorage.setItem('authUsername', authUsername);
                showAdmin();
            } else document.getElementById('twoFactorError').textContent = res?.error || '验证失败';
        });

        const cancel2FA = () => {
            document.getElementById('loginBox').style.display = 'block';
            document.getElementById('twoFactorBox').style.display = 'none';
            document.getElementById('twoFactorError').textContent = '';
        };

        document.getElementById('cookieForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('cookieId').value;
            const skipValidation = document.getElementById('skipValidation').checked;
            const data = { platform: document.getElementById('cookiePlatform').value, cookie: document.getElementById('cookieData').value, note: document.getElementById('cookieNote').value, isActive: document.getElementById('cookieActive').checked, skipValidation };
            const submitBtn = document.getElementById('cookieSubmitBtn');
            submitBtn.disabled = true; submitBtn.innerHTML = '<span class="loading"></span> 验证中...';
            let res;
            if (id) res = await api('/admin/cookies/' + id, { method: 'PUT', body: JSON.stringify(data) });
            else res = await api('/admin/cookies', { method: 'POST', body: JSON.stringify(data) });
            submitBtn.disabled = false; submitBtn.textContent = id ? '保存' : '保存并验证';
            if (res?.success) {
                let msg = 'Cookie已保存';
                const isSvip = Boolean(res.data?.userInfo?.isSvip || res.data?.userInfo?.canPlaySvip || Number(res.data?.userInfo?.svipType) > 0 || String(res.data?.userInfo?.vipStage || res.data?.userInfo?.vip_stage || '').toLowerCase() === 'svip');
                if (!skipValidation && isSvip) msg += ' - 可播放SVIP音乐';
                else if (!skipValidation && res.data?.userInfo?.canPlayVip !== undefined) msg += res.data.userInfo.canPlayVip ? ' - 可播放VIP音乐' : ' - 不可播放VIP音乐';
                showToast(msg, 'success'); closeModal('cookieModal'); loadCookies(); loadDashboard();
            } else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('userForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const editUsername = document.getElementById('editUsername').value;
            const data = { username: document.getElementById('userUsername').value, password: document.getElementById('userPassword').value, role: document.getElementById('userRole').value };
            let res;
            if (editUsername) res = await api('/admin/users/' + editUsername, { method: 'PUT', body: JSON.stringify(data) });
            else res = await api('/admin/users', { method: 'POST', body: JSON.stringify(data) });
            if (res?.success) { showToast('用户已保存'); closeModal('userModal'); loadUsers(); }
            else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUsername = document.getElementById('newUsername').value.trim();
            if (!newUsername) { showToast('请输入新用户名', 'error'); return; }
            if (newUsername === authUsername) { showToast('新用户名与当前用户名相同', 'error'); return; }
            const res = await api('/admin/profile', { method: 'PUT', body: JSON.stringify({ newUsername }) });
            if (res?.success) {
                authUsername = newUsername; localStorage.setItem('authUsername', newUsername);
                document.getElementById('currentUser').textContent = newUsername;
                document.getElementById('currentUsernameDisplay').value = newUsername;
                document.getElementById('newUsername').value = ''; showToast('用户名已修改');
            } else showToast(res?.error || '修改失败', 'error');
        });

        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (newPassword !== confirmPassword) { showToast('两次输入的密码不一致', 'error'); return; }
            const res = await api('/admin/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) });
            if (res?.success) { showToast('密码已修改'); document.getElementById('changePasswordForm').reset(); }
            else showToast(res?.error || '修改失败', 'error');
        });

        document.getElementById('adminPathForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminPath = document.getElementById('adminPathInput').value.trim();
            if (!adminPath) { showToast('请输入管理后台路径', 'error'); return; }
            const res = await api('/admin/config/admin-path', { method: 'PUT', body: JSON.stringify({ adminPath }) });
            if (res?.success) showToast('管理后台路径已保存，重启服务后生效');
            else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('qishuiSignerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('qishuiSignerUrl').value.trim();
            const res = await api('/admin/config/qishui-signer', { method: 'PUT', body: JSON.stringify({ url }) });
            if (res?.success) showToast('汽水签名地址已保存');
            else showToast(res?.error || '保存失败', 'error');
        });
        document.getElementById('loudnessServiceForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('loudnessServiceUrl').value.trim();
            const res = await api('/admin/config/loudness-service', { method: 'PUT', body: JSON.stringify({ url }) });
            if (res?.success) showToast('响度辅助服务地址已保存');
            else showToast(res?.error || '保存失败', 'error');
        });
        document.getElementById('monitorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const enabled = document.getElementById('monitorEnabled').checked;
            const interval = parseInt(document.getElementById('monitorIntervalInput').value);
            const res = await api('/admin/monitor', { method: 'PUT', body: JSON.stringify({ enabled, interval }) });
            if (res?.success) { showToast('监测设置已保存'); loadMonitor(); }
            else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('webhookForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const enabled = document.getElementById('webhookEnabled').checked;
            const url = document.getElementById('webhookUrl').value.trim();
            const contentType = document.getElementById('webhookContentType').value;
            const headersStr = document.getElementById('webhookHeaders').value.trim();
            const bodyTemplateStr = document.getElementById('webhookBodyTemplate').value.trim();
            let headers = {};
            if (headersStr) { try { headers = JSON.parse(headersStr); } catch { showToast('Headers JSON格式无效', 'error'); return; } }
            const res = await api('/admin/webhook', { method: 'PUT', body: JSON.stringify({ enabled, url, contentType, headers, bodyTemplate: bodyTemplateStr || undefined }) });
            if (res?.success) showToast('Webhook设置已保存');
            else showToast(res?.error || '保存失败', 'error');
        });

        let twoFASetupData = null;
        let twoFASetupStep = 1;

        const load2FAStatus = async () => {
            const res = await api('/admin/2fa/status');
            if (res?.success) {
                if (res.data.enabled) {
                    document.getElementById('twoFactorDisabled').style.display = 'none';
                    document.getElementById('twoFactorEnabled').style.display = 'block';
                } else {
                    document.getElementById('twoFactorDisabled').style.display = 'block';
                    document.getElementById('twoFactorEnabled').style.display = 'none';
                }
            }
        };

        const startSetup2FA = async () => {
            const res = await api('/admin/2fa/setup', { method: 'POST' });
            if (!res?.success) { showToast(res?.error || '获取2FA设置失败', 'error'); return; }
            twoFASetupData = res.data;
            twoFASetupStep = 1;
            document.getElementById('twoFactorStep1').style.display = 'block';
            document.getElementById('twoFactorStep2').style.display = 'none';
            document.getElementById('twoFactorStep3').style.display = 'none';
            document.getElementById('twoFactorSetupBack').style.display = 'none';
            document.getElementById('twoFactorSetupNext').style.display = 'inline-flex';
            document.getElementById('twoFactorSetupNext').textContent = '下一步';
            document.getElementById('twoFactorSetupFinish').style.display = 'none';
            document.getElementById('twoFactorSecretDisplay').value = twoFASetupData.secret;
            generateQRCode(twoFASetupData.otpAuthUrl);
            document.getElementById('twoFactorSetupModal').classList.add('show');
        };

        const generateQRCode = (text) => {
            const container = document.getElementById('qrcodeContainer');
            container.innerHTML = '';
            const img = document.createElement('img');
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(text);
            img.alt = '2FA QR Code';
            img.style.width = '200px';
            img.style.height = '200px';
            img.onerror = () => {
                img.remove();
                const fallback = document.createElement('div');
                fallback.style.cssText = 'padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;';
                fallback.innerHTML = '二维码加载失败，请使用下方密钥手动输入';
                container.appendChild(fallback);
            };
            container.appendChild(img);
        };

        const twoFactorSetupGoNext = async () => {
            if (twoFASetupStep === 1) {
                twoFASetupStep = 2;
                document.getElementById('twoFactorStep1').style.display = 'none';
                document.getElementById('twoFactorStep2').style.display = 'block';
                document.getElementById('twoFactorSetupBack').style.display = 'inline-flex';
                document.getElementById('twoFactorSetupNext').textContent = '验证';
                document.getElementById('twoFactorSetupCode').value = '';
                document.getElementById('twoFactorSetupError').textContent = '';
                document.getElementById('twoFactorSetupCode').focus();
            } else if (twoFASetupStep === 2) {
                const code = document.getElementById('twoFactorSetupCode').value.trim();
                if (!code) { document.getElementById('twoFactorSetupError').textContent = '请输入验证码'; return; }
                const res = await api('/admin/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
                if (res?.success) {
                    twoFASetupStep = 3;
                    document.getElementById('twoFactorStep2').style.display = 'none';
                    document.getElementById('twoFactorStep3').style.display = 'block';
                    document.getElementById('twoFactorSetupBack').style.display = 'none';
                    document.getElementById('twoFactorSetupNext').style.display = 'none';
                    document.getElementById('twoFactorSetupFinish').style.display = 'inline-flex';
                    load2FAStatus();
                } else {
                    document.getElementById('twoFactorSetupError').textContent = res?.error || '验证码错误';
                }
            }
        };

        const twoFactorSetupGoBack = () => {
            if (twoFASetupStep === 2) {
                twoFASetupStep = 1;
                document.getElementById('twoFactorStep1').style.display = 'block';
                document.getElementById('twoFactorStep2').style.display = 'none';
                document.getElementById('twoFactorSetupBack').style.display = 'none';
                document.getElementById('twoFactorSetupNext').textContent = '下一步';
            }
        };

        document.getElementById('twoFactorSetupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            twoFactorSetupGoNext();
        });

        const copy2FASecret = () => {
            const secret = document.getElementById('twoFactorSecretDisplay').value;
            navigator.clipboard.writeText(secret).then(() => showToast('密钥已复制'));
        };

        const showDisable2FAModal = () => {
            document.getElementById('disable2FAPassword').value = '';
            document.getElementById('disable2FAError').textContent = '';
            document.getElementById('twoFactorDisableModal').classList.add('show');
        };

        document.getElementById('twoFactorDisableForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('disable2FAPassword').value;
            if (!password) { document.getElementById('disable2FAError').textContent = '请输入密码'; return; }
            const res = await api('/admin/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) });
            if (res?.success) {
                showToast('双因素认证已禁用');
                closeModal('twoFactorDisableModal');
                load2FAStatus();
            } else {
                document.getElementById('disable2FAError').textContent = res?.error || '操作失败';
            }
        });

        document.querySelectorAll('.sidebar-menu li').forEach(li => {
            li.addEventListener('click', () => switchSection(li.dataset.section));
        });

        if (authToken && authUsername) {
            api('/admin/check').then(res => { if (res?.success) showAdmin(); else showLogin(); });
        } else showLogin();
    </script>
</body>
</html>`

export const adminPageHandler = (c) => {
    return c.html(getAdminHtml())
}
