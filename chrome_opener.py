#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chrome Opener - Gelismis surum
Belirtilen sayida Google sekmesini hizli sekilde acar.
Windows aciliisinda otomatik baslatma destegi vardir.

Kullanim:
    chrome_opener.exe                 -> 5 Google sekmesi acar
    chrome_opener.exe -n 8            -> 8 sekme acar
    chrome_opener.exe -u https://... -> baska bir URL acar
    chrome_opener.exe --install       -> Windows aciliisina ekler
    chrome_opener.exe --uninstall     -> Windows aciliisindan cikarir
"""

import argparse
import sys
import os
import time
import webbrowser

DEFAULT_URL = "https://www.google.com"
DEFAULT_COUNT = 5
APP_NAME = "ChromeOpener"


def find_chrome():
    """Windows'ta yuklu Chrome yolunu bulmaya calisir. Bulamazsa None doner."""
    candidates = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def open_tabs(url, count, delay):
    """count kadar sekmeyi url ile acar. Chrome bulunursa dogrudan onu kullanir."""
    chrome_path = find_chrome()
    opened = 0

    if chrome_path:
        # Chrome'u dogrudan cagirarak sekmeleri ayni pencerede hizlica acar.
        try:
            browser = webbrowser.get(f'"{chrome_path}" %s')
        except webbrowser.Error:
            browser = None
    else:
        browser = None

    for i in range(count):
        try:
            if browser is not None:
                # new=2 -> yeni sekme
                browser.open(url, new=2, autoraise=False)
            else:
                # Chrome bulunamazsa varsayilan tarayiciyi kullan
                webbrowser.open(url, new=2, autoraise=False)
            opened += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[!] Sekme {i + 1} acilamadi: {exc}", file=sys.stderr)
        if delay > 0 and i < count - 1:
            time.sleep(delay)

    return opened, chrome_path


def install_startup():
    """Programin kendisini Windows aciliis kayit defterine (Run) ekler."""
    if os.name != "nt":
        print("[!] Aciliis kaydi yalnizca Windows'ta desteklenir.", file=sys.stderr)
        return False
    import winreg  # type: ignore

    exe_path = get_self_path()
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
        winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{exe_path}"')
    print(f"[+] Aciliisa eklendi: {exe_path}")
    return True


def uninstall_startup():
    """Aciliis kaydini kaldirir."""
    if os.name != "nt":
        print("[!] Aciliis kaydi yalnizca Windows'ta desteklenir.", file=sys.stderr)
        return False
    import winreg  # type: ignore

    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, APP_NAME)
        print("[+] Aciliis kaydi kaldirildi.")
        return True
    except FileNotFoundError:
        print("[i] Aciliis kaydi zaten yok.")
        return True


def get_self_path():
    """Derlenmis exe ise exe yolunu, degilse script yolunu doner."""
    if getattr(sys, "frozen", False):
        return sys.executable
    return os.path.abspath(__file__)


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Belirtilen sayida Google sekmesini hizlica acar."
    )
    parser.add_argument("-n", "--count", type=int, default=DEFAULT_COUNT,
                        help=f"Acilacak sekme sayisi (varsayilan: {DEFAULT_COUNT})")
    parser.add_argument("-u", "--url", default=DEFAULT_URL,
                        help=f"Acilacak URL (varsayilan: {DEFAULT_URL})")
    parser.add_argument("-d", "--delay", type=float, default=0.0,
                        help="Sekmeler arasi bekleme (saniye, varsayilan: 0)")
    parser.add_argument("--install", action="store_true",
                        help="Windows aciliisina ekle")
    parser.add_argument("--uninstall", action="store_true",
                        help="Windows aciliisindan cikar")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])

    if args.install:
        return 0 if install_startup() else 1
    if args.uninstall:
        return 0 if uninstall_startup() else 1

    count = max(1, min(args.count, 50))  # 1..50 ile sinirli tut
    print(f"[i] {count} sekme aciliyor -> {args.url}")
    opened, chrome_path = open_tabs(args.url, count, max(0.0, args.delay))
    if chrome_path:
        print(f"[i] Chrome: {chrome_path}")
    else:
        print("[i] Chrome bulunamadi, varsayilan tarayici kullanildi.")
    print(f"[+] Acilan sekme sayisi: {opened}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
