#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WinKey Blocker - Gelismis surum
Windows (Win logo) tusunu engeller. Oyun/kiosk modunda yanlislikla
masaustune dusmeyi onler. Sol ve sag Win tuslarini yutar.

Cikis: Ctrl + Alt + Q  (Win tusu engelliyken bile calisir)

Kullanim:
    winkey_blocker.exe               -> Engellemeyi baslatir (+ aciliisa ekler)
    winkey_blocker.exe --no-startup  -> Sadece calistir, aciliisa ekleme
    winkey_blocker.exe --uninstall   -> Aciliistan cikarir ve cikar
"""

import sys
import os
import ctypes
import ctypes.wintypes as wt
import argparse

APP_NAME = "WinKeyBlocker"

# --- Windows sabitleri ---
WH_KEYBOARD_LL = 13
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_SYSKEYDOWN = 0x0104
WM_SYSKEYUP = 0x0105
WM_HOTKEY = 0x0312
VK_LWIN = 0x5B
VK_RWIN = 0x5C
MOD_CONTROL = 0x0002
MOD_ALT = 0x0001
VK_Q = 0x51
HC_ACTION = 0

user32 = ctypes.windll.user32 if os.name == "nt" else None
kernel32 = ctypes.windll.kernel32 if os.name == "nt" else None

# Hook geri cagrisi imzasi
LowLevelKeyboardProc = ctypes.WINFUNCTYPE(
    ctypes.c_long, ctypes.c_int, wt.WPARAM, wt.LPARAM
)


class KBDLLHOOKSTRUCT(ctypes.Structure):
    _fields_ = [
        ("vkCode", wt.DWORD),
        ("scanCode", wt.DWORD),
        ("flags", wt.DWORD),
        ("time", wt.DWORD),
        ("dwExtraInfo", ctypes.POINTER(wt.ULONG)),
    ]


_hook_handle = None
_callback_ref = None  # GC'ye yem olmasin diye referans tutuyoruz


def _low_level_handler(nCode, wParam, lParam):
    if nCode == HC_ACTION:
        kb = ctypes.cast(lParam, ctypes.POINTER(KBDLLHOOKSTRUCT)).contents
        if kb.vkCode in (VK_LWIN, VK_RWIN):
            # 1 dondurerek tusu yut (uygulamalara ulasmaz)
            return 1
    return user32.CallNextHookEx(None, nCode, wParam, lParam)


def install_hook():
    global _hook_handle, _callback_ref
    _callback_ref = LowLevelKeyboardProc(_low_level_handler)
    module = kernel32.GetModuleHandleW(None)
    _hook_handle = user32.SetWindowsHookExW(
        WH_KEYBOARD_LL, _callback_ref, module, 0
    )
    if not _hook_handle:
        raise ctypes.WinError(ctypes.get_last_error())


def remove_hook():
    global _hook_handle
    if _hook_handle:
        user32.UnhookWindowsHookEx(_hook_handle)
        _hook_handle = None


def message_loop():
    """Cikis kisayolu (Ctrl+Alt+Q) gelene kadar mesajlari isler."""
    # Global kisayol kaydi
    if not user32.RegisterHotKey(None, 1, MOD_CONTROL | MOD_ALT, VK_Q):
        print("[!] Cikis kisayolu kaydedilemedi (Ctrl+Alt+Q).", file=sys.stderr)

    msg = wt.MSG()
    while True:
        ret = user32.GetMessageW(ctypes.byref(msg), None, 0, 0)
        if ret == 0 or ret == -1:
            break
        if msg.message == WM_HOTKEY and msg.wParam == 1:
            print("[i] Ctrl+Alt+Q algilandi, cikiliyor.")
            break
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))

    user32.UnregisterHotKey(None, 1)


# --- Aciliis yonetimi ---
def get_self_path():
    if getattr(sys, "frozen", False):
        return sys.executable
    return os.path.abspath(__file__)


def _startup_command():
    return f'"{get_self_path()}" --no-startup'


def ensure_startup():
    if os.name != "nt":
        return False
    import winreg
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    desired = _startup_command()
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0,
                            winreg.KEY_READ | winreg.KEY_SET_VALUE) as key:
            try:
                current, _ = winreg.QueryValueEx(key, APP_NAME)
                if current == desired:
                    return True
            except FileNotFoundError:
                pass
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, desired)
        print("[+] Aciliisa eklendi.")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[!] Aciliisa eklenemedi: {exc}", file=sys.stderr)
        return False


def uninstall_startup():
    if os.name != "nt":
        print("[!] Aciliis kaydi yalnizca Windows'ta desteklenir.", file=sys.stderr)
        return False
    import winreg
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0,
                            winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, APP_NAME)
        print("[+] Aciliis kaydi kaldirildi.")
    except FileNotFoundError:
        print("[i] Aciliis kaydi zaten yok.")
    return True


def parse_args(argv):
    p = argparse.ArgumentParser(description="Windows (Win logo) tusunu engeller.")
    p.add_argument("--no-startup", dest="no_startup", action="store_true",
                   help="Bu calistirmada aciliisa ekleme")
    p.add_argument("--uninstall", action="store_true",
                   help="Aciliistan cikar ve cik")
    return p.parse_args(argv)


def main(argv=None):
    if os.name != "nt":
        print("[!] Bu program yalnizca Windows'ta calisir.", file=sys.stderr)
        return 1

    args = parse_args(argv if argv is not None else sys.argv[1:])

    if args.uninstall:
        uninstall_startup()
        return 0

    if not args.no_startup:
        ensure_startup()

    print("[i] Win tusu engelleniyor. Cikmak icin: Ctrl + Alt + Q")
    try:
        install_hook()
        message_loop()
    finally:
        remove_hook()
    print("[i] Engelleme durduruldu.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
