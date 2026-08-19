#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vanguard tarzi sahte HWID ban ekrani.
Sistemde hicbir sey degistirmez, hicbir dosyaya dokunmaz - sadece bir pencere cizer.

CIKIS: Page Up tusu.
(Guvenlik icin 5 dakika sonunda kendiliginden de kapanir.)
"""

import random
import tkinter as tk
from tkinter import font as tkfont

# ------------------------------------------------------------------ ayarlar
OTO_KAPANMA_SN = 1800         # sessiz emniyet valfi (30 dk)
BG1, BG2 = "#0b0000", "#140202"
RED, RED_SOFT, CYAN = "#e01b24", "#ff4d4d", "#00b7c3"
GREY, WHITE, DIM = "#8f8080", "#efe4e4", "#4a3838"

HEX = "0123456789ABCDEF"

LOG_POOL = [
    "kernel driver signature mismatch  ->  vgk.sys",
    "memory region 0x{a} flagged: WRITE_PROCESS_MEMORY",
    "handle stripping attempt blocked  (pid {p})",
    "unsigned module loaded from \\Device\\HarddiskVolume3",
    "hooked entry: NtQuerySystemInformation  [0x{a}]",
    "input pattern deviation: {n}% above human baseline",
    "overlay surface detected on D3D11 swapchain",
    "hypervisor artifact present  ->  VMEXIT timing anomaly",
    "smbios serial hashed  ->  {h}",
    "disk volume GUID collected  ->  {h}",
    "TPM endorsement key bound to ban record",
    "MAC 8C:{m}:{m}:{m} added to restriction list",
    "uploading telemetry bundle  ({n} KB)",
    "peer report cross-reference: {n} matches",
    "enforcement policy PERMANENT applied to device",
]

TROLL_LINES = [
    "Error 0xDEADBEEF: skill issue detected at hardware level.",
    "Your mouse was moving suspiciously well. That's illegal here.",
    "We scanned your aim and found nothing. Banned anyway.",
    "Hardware banned. Your motherboard sends its regards.",
    "We couldn't find cheats, but we found your K/D. Same thing.",
    "Ticket #404: appeal not found. Please touch grass instead.",
    "This ban is permanent, irreversible, and honestly deserved.",
]


def rnd(n, pool=HEX):
    return "".join(random.choice(pool) for _ in range(n))


def hwid():
    return "-".join(rnd(8) for _ in range(4))


def log_satiri():
    return random.choice(LOG_POOL).format(
        a=rnd(8), h=rnd(12), m=rnd(2), p=random.randint(1000, 9999),
        n=random.randint(11, 97))


# ------------------------------------------------------------------ ekran
class VanguardBan:
    def __init__(self, root):
        self.root = root
        self.root.title("Riot Vanguard")
        self.root.configure(bg=BG1)
        self.root.attributes("-fullscreen", True)
        try:
            self.root.attributes("-topmost", True)
        except tk.TclError:
            pass
        self.root.config(cursor="none")

        # tek cikis: Page Up
        self.root.bind_all("<Prior>", self.kapat)
        self.root.protocol("WM_DELETE_WINDOW", lambda: None)
        self.root.after(OTO_KAPANMA_SN * 1000, self.kapat)

        self.W = self.root.winfo_screenwidth()
        self.H = self.root.winfo_screenheight()

        self.canvas = tk.Canvas(self.root, width=self.W, height=self.H,
                                bg=BG1, highlightthickness=0, bd=0)
        self.canvas.pack(fill="both", expand=True)

        self._fontlar()
        self._ciz()

        self.loglar = []
        self.ilerleme = 0.0
        self.tarama_y = 0

        self._tick_flicker()
        self._tick_tarama()
        self._tick_glitch()
        self._tick_log()
        self._tick_ilerleme()

    # -------------------------------------------------------------- fontlar
    def _fontlar(self):
        ai = set(tkfont.families())
        basl = next((f for f in ("Impact", "Arial Black", "DejaVu Sans",
                                 "Helvetica") if f in ai), "TkDefaultFont")
        mono = next((f for f in ("Consolas", "DejaVu Sans Mono", "Courier New",
                                 "Courier") if f in ai), "TkFixedFont")
        h = self.H
        self.f_logo = tkfont.Font(family=basl, size=max(12, int(h * 0.020)), weight="bold")
        self.f_title = tkfont.Font(family=basl, size=max(30, int(h * 0.070)), weight="bold")
        self.f_sub = tkfont.Font(family=mono, size=max(10, int(h * 0.016)))
        self.f_mono = tkfont.Font(family=mono, size=max(8, int(h * 0.013)))
        self.f_log = tkfont.Font(family=mono, size=max(7, int(h * 0.011)))
        self.f_troll = tkfont.Font(family=mono, size=max(9, int(h * 0.014)), slant="italic")

    # ---------------------------------------------------------------- cizim
    def _ciz(self):
        c, W, H = self.canvas, self.W, self.H
        cx = W // 2

        # tarama cizgileri (statik dokusu)
        for y in range(0, H, 3):
            c.create_line(0, y, W, y, fill="#000000", width=1)

        # ust / alt kirmizi seritler
        c.create_rectangle(0, 0, W, 5, fill=RED, outline="")
        c.create_rectangle(0, H - 5, W, H, fill=RED, outline="")

        # hareketli tarama bandi
        self.band = c.create_rectangle(0, 0, W, 90, fill="#1a0404", outline="")
        c.tag_lower(self.band)

        # logo
        c.create_text(cx, int(H * 0.17), text="⛛   R I O T   V A N G U A R D",
                      fill=RED_SOFT, font=self.f_logo)

        # glitch katmanlari + ana baslik
        ty = int(H * 0.28)
        self.g_cyan = c.create_text(cx, ty, text="HARDWARE ID BANNED",
                                    fill=CYAN, font=self.f_title)
        self.g_red = c.create_text(cx, ty, text="HARDWARE ID BANNED",
                                   fill="#7a0d12", font=self.f_title)
        self.title = c.create_text(cx, ty, text="HARDWARE ID BANNED",
                                   fill=RED, font=self.f_title)
        self.ty = ty

        c.create_text(cx, ty + int(H * 0.075),
                      text="This device has been permanently restricted. "
                           "All accounts linked to this machine are affected.",
                      fill=GREY, font=self.f_sub)

        # ayirici
        c.create_line(cx - int(W * 0.30), int(H * 0.40),
                      cx + int(W * 0.30), int(H * 0.40), fill="#3a1010")

        # detay tablosu
        detaylar = [
            ("HWID", hwid()),
            ("BAN ID", rnd(16)),
            ("ERROR CODE", "VAN-0x" + rnd(4)),
            ("DURATION", "PERMANENT"),
            ("REASON", "Unauthorized third-party software (TIER 3)"),
            ("APPEAL", "Not available for this offense"),
        ]
        y = int(H * 0.45)
        step = int(H * 0.033)
        for etiket, deger in detaylar:
            c.create_text(cx - int(W * 0.02), y, text=etiket + " :",
                          fill=GREY, font=self.f_mono, anchor="e")
            c.create_text(cx + int(W * 0.01), y, text=deger,
                          fill=WHITE, font=self.f_mono, anchor="w")
            y += step

        # rapor gonderme cubugu
        self.bar_y = y + int(H * 0.03)
        bw = int(W * 0.34)
        self.bar_x0, self.bar_x1 = cx - bw // 2, cx + bw // 2
        c.create_rectangle(self.bar_x0, self.bar_y, self.bar_x1,
                           self.bar_y + 12, outline="#3a1010")
        self.bar_fill = c.create_rectangle(self.bar_x0 + 1, self.bar_y + 1,
                                           self.bar_x0 + 1, self.bar_y + 11,
                                           fill=RED, outline="")
        self.bar_txt = c.create_text(cx, self.bar_y + 30,
                                     text="UPLOADING ENFORCEMENT REPORT...  0%",
                                     fill=GREY, font=self.f_log)

        # log paneli
        self.log_x = int(W * 0.06)
        self.log_y = int(H * 0.74)
        c.create_text(self.log_x, self.log_y - 22,
                      text="vgk.sys :: live integrity scan", fill=DIM,
                      font=self.f_log, anchor="w")
        self.log_items = []
        for i in range(8):
            self.log_items.append(
                c.create_text(self.log_x, self.log_y + i * int(H * 0.019),
                              text="", fill=DIM, font=self.f_log, anchor="w"))

        # alt mesaj
        c.create_text(cx, int(H * 0.95), text=random.choice(TROLL_LINES),
                      fill="#6b5a5a", font=self.f_troll)

    # ----------------------------------------------------------- animasyon
    def _tick_flicker(self):
        self.canvas.itemconfig(
            self.title, fill=RED if self.canvas.itemcget(self.title, "fill") == RED_SOFT else RED_SOFT)
        if random.random() < 0.25:
            self.canvas.configure(bg=random.choice((BG1, BG2)))
        self.root.after(620, self._tick_flicker)

    def _tick_tarama(self):
        self.tarama_y = (self.tarama_y + 7) % (self.H + 120)
        self.canvas.coords(self.band, 0, self.tarama_y - 90, self.W, self.tarama_y)
        self.root.after(28, self._tick_tarama)

    def _tick_glitch(self):
        cx = self.W // 2
        if random.random() < 0.55:
            dx = random.randint(-9, 9)
            dy = random.randint(-3, 3)
            self.canvas.coords(self.g_cyan, cx - dx, self.ty + dy)
            self.canvas.coords(self.g_red, cx + dx, self.ty - dy)
            self.root.after(70, lambda: (self.canvas.coords(self.g_cyan, cx, self.ty),
                                         self.canvas.coords(self.g_red, cx, self.ty)))
        self.root.after(random.randint(700, 2600), self._tick_glitch)

    def _tick_log(self):
        self.loglar.append("[{:02d}:{:02d}:{:02d}]  {}".format(
            random.randint(0, 23), random.randint(0, 59), random.randint(0, 59),
            log_satiri()))
        self.loglar = self.loglar[-8:]
        for i, item in enumerate(self.log_items):
            metin = self.loglar[i] if i < len(self.loglar) else ""
            renk = RED_SOFT if i == len(self.loglar) - 1 else DIM
            self.canvas.itemconfig(item, text=metin, fill=renk)
        self.root.after(random.randint(220, 900), self._tick_log)

    def _tick_ilerleme(self):
        if self.ilerleme < 100:
            self.ilerleme = min(100.0, self.ilerleme + random.uniform(0.3, 2.4))
            w = (self.bar_x1 - self.bar_x0 - 2) * self.ilerleme / 100.0
            self.canvas.coords(self.bar_fill, self.bar_x0 + 1, self.bar_y + 1,
                               self.bar_x0 + 1 + w, self.bar_y + 11)
            self.canvas.itemconfig(
                self.bar_txt,
                text="UPLOADING ENFORCEMENT REPORT...  {:.0f}%".format(self.ilerleme))
            self.root.after(random.randint(120, 400), self._tick_ilerleme)
        else:
            self.canvas.itemconfig(
                self.bar_txt, fill=RED_SOFT,
                text="REPORT DELIVERED  -  DEVICE RESTRICTION IS NOW ACTIVE")

    # -------------------------------------------------------------- kapat
    def kapat(self, event=None):
        try:
            self.root.destroy()
        except tk.TclError:
            pass



# ------------------------------------------------------------ acilista baslatma
import os
import sys


def _startup_klasoru():
    """Windows Startup klasoru; diger OS'lerde None."""
    if os.name != "nt":
        return None
    appdata = os.environ.get("APPDATA")
    if not appdata:
        return None
    return os.path.join(appdata, r"Microsoft\Windows\Start Menu\Programs\Startup")


def _kisayol_yolu(klasor):
    return os.path.join(klasor, "VanguardBan.bat")


def kur():
    """Kendini Windows acilis klasorune kaydeder (kayit defterine dokunmaz)."""
    klasor = _startup_klasoru()
    if not klasor:
        print("Bu ozellik yalnizca Windows'ta calisir.")
        return
    os.makedirs(klasor, exist_ok=True)
    py = sys.executable
    # konsol penceresi acilmasin diye pythonw varsa onu kullan
    pyw = py.lower().replace("python.exe", "pythonw.exe")
    if os.path.exists(pyw):
        py = pyw
    hedef = os.path.abspath(__file__)
    bat = _kisayol_yolu(klasor)
    with open(bat, "w", encoding="utf-8") as f:
        f.write("@echo off\r\n")
        f.write('start "" "{}" "{}"\r\n'.format(py, hedef))
    print("Kuruldu. Bilgisayar her acildiginda baslayacak.")
    print("Konum: " + bat)


def kaldir():
    klasor = _startup_klasoru()
    if not klasor:
        print("Bu ozellik yalnizca Windows'ta calisir.")
        return
    bat = _kisayol_yolu(klasor)
    if os.path.exists(bat):
        os.remove(bat)
        print("Kaldirildi. Artik acilista baslamayacak.")
    else:
        print("Zaten kurulu degil.")


def main():
    root = tk.Tk()
    VanguardBan(root)
    root.mainloop()


if __name__ == "__main__":
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    if arg in ("--install", "-i", "install"):
        kur()
    elif arg in ("--uninstall", "-u", "uninstall"):
        kaldir()
    else:
        main()
