#!/usr/bin/env python3
"""
gui_app.py - Modern Graphical User Interface for Stealth Anti-Detect Browser.
Provides a clean, native desktop dashboard to manage, configure, and launch
isolated browser identities without any cloud account or login requirements.
"""

import os
import sys
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
from typing import Dict, Optional

from stealth_browser.profile_manager import ProfileManager, HARDWARE_PRESETS
from stealth_browser.launcher import StealthLauncher, find_chrome_executable


class ModernTheme:
    BG_DARK = "#181825"
    PANEL_BG = "#1e1e2e"
    CARD_BG = "#262639"
    BORDER_COLOR = "#313244"
    TEXT_MAIN = "#cdd6f4"
    TEXT_MUTED = "#a6adc8"
    ACCENT_BLUE = "#3b82f6"
    ACCENT_BLUE_HOVER = "#2563eb"
    ACCENT_GREEN = "#10b981"
    ACCENT_GREEN_HOVER = "#059669"
    ACCENT_RED = "#ef4444"
    ACCENT_RED_HOVER = "#dc2626"
    FONT_FAMILY = "Segoe UI"


class StealthBrowserGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Octo Stealth Anti-Detect Manager v1.0 (Offline Edition)")
        self.root.geometry("980x620")
        self.root.minsize(850, 500)
        self.root.configure(bg=ModernTheme.BG_DARK)

        self.profile_mgr = ProfileManager()
        self.launcher = StealthLauncher()
        self.active_processes: Dict[str, subprocess.Popen] = {}

        self._setup_styles()
        self._build_ui()
        self._refresh_profile_list()

        # Polling to monitor running browser instances
        self.root.after(1000, self._check_process_status)

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Configure generic TTK elements
        style.configure(".", background=ModernTheme.BG_DARK, foreground=ModernTheme.TEXT_MAIN, font=(ModernTheme.FONT_FAMILY, 10))

        # Treeview styling
        style.configure(
            "Treeview",
            background=ModernTheme.CARD_BG,
            foreground=ModernTheme.TEXT_MAIN,
            fieldbackground=ModernTheme.CARD_BG,
            rowheight=34,
            font=(ModernTheme.FONT_FAMILY, 10),
            borderwidth=0
        )
        style.configure(
            "Treeview.Heading",
            background=ModernTheme.PANEL_BG,
            foreground=ModernTheme.TEXT_MAIN,
            font=(ModernTheme.FONT_FAMILY, 10, "bold"),
            relief="flat",
            padding=6
        )
        style.map("Treeview", background=[("selected", ModernTheme.ACCENT_BLUE)], foreground=[("selected", "#ffffff")])

        # Scrollbar styling
        style.configure("Vertical.TScrollbar", background=ModernTheme.PANEL_BG, borderwidth=0, arrowsize=12)

    def _build_ui(self):
        # 1. TOP HEADER BAR
        header_frame = tk.Frame(self.root, bg=ModernTheme.PANEL_BG, height=65, padx=20, pady=12)
        header_frame.pack(fill=tk.X, side=tk.TOP)

        title_lbl = tk.Label(
            header_frame,
            text="Octo Stealth Anti-Detect",
            font=(ModernTheme.FONT_FAMILY, 16, "bold"),
            bg=ModernTheme.PANEL_BG,
            fg=ModernTheme.TEXT_MAIN
        )
        title_lbl.pack(side=tk.LEFT)

        badge_lbl = tk.Label(
            header_frame,
            text=" 100% OFFLINE / BEBAS LOGIN ",
            font=(ModernTheme.FONT_FAMILY, 8, "bold"),
            bg="#065f46",
            fg="#a7f3d0",
            padx=8,
            pady=2
        )
        badge_lbl.pack(side=tk.LEFT, padx=12)

        self.stats_lbl = tk.Label(
            header_frame,
            text="Total Profil: 0 | Aktif: 0",
            font=(ModernTheme.FONT_FAMILY, 10),
            bg=ModernTheme.PANEL_BG,
            fg=ModernTheme.TEXT_MUTED
        )
        self.stats_lbl.pack(side=tk.RIGHT)

        # 2. TOOLBAR ACTION BUTTONS
        toolbar_frame = tk.Frame(self.root, bg=ModernTheme.BG_DARK, padx=20, pady=12)
        toolbar_frame.pack(fill=tk.X)

        btn_new = tk.Button(
            toolbar_frame,
            text="+ Buat Profil Baru",
            font=(ModernTheme.FONT_FAMILY, 10, "bold"),
            bg=ModernTheme.ACCENT_BLUE,
            fg="#ffffff",
            activebackground=ModernTheme.ACCENT_BLUE_HOVER,
            activeforeground="#ffffff",
            relief="flat",
            padx=14,
            pady=6,
            cursor="hand2",
            command=self._show_create_profile_dialog
        )
        btn_new.pack(side=tk.LEFT, padx=(0, 10))

        btn_refresh = tk.Button(
            toolbar_frame,
            text="⟳ Refresh Daftar",
            font=(ModernTheme.FONT_FAMILY, 10),
            bg=ModernTheme.CARD_BG,
            fg=ModernTheme.TEXT_MAIN,
            activebackground=ModernTheme.BORDER_COLOR,
            activeforeground=ModernTheme.TEXT_MAIN,
            relief="flat",
            padx=12,
            pady=6,
            cursor="hand2",
            command=self._refresh_profile_list
        )
        btn_refresh.pack(side=tk.LEFT, padx=(0, 10))

        # Target URL Entry
        url_lbl = tk.Label(
            toolbar_frame,
            text="Target URL:",
            font=(ModernTheme.FONT_FAMILY, 9),
            bg=ModernTheme.BG_DARK,
            fg=ModernTheme.TEXT_MUTED
        )
        url_lbl.pack(side=tk.LEFT, padx=(15, 6))

        self.url_var = tk.StringVar(value="https://browserleaks.com/canvas")
        url_entry = tk.Entry(
            toolbar_frame,
            textvariable=self.url_var,
            font=(ModernTheme.FONT_FAMILY, 10),
            bg=ModernTheme.CARD_BG,
            fg=ModernTheme.TEXT_MAIN,
            insertbackground=ModernTheme.TEXT_MAIN,
            relief="flat",
            width=32
        )
        url_entry.pack(side=tk.LEFT, padx=(0, 10), ipady=4)

        btn_test = tk.Button(
            toolbar_frame,
            text="Uji Fingerprint",
            font=(ModernTheme.FONT_FAMILY, 9),
            bg=ModernTheme.CARD_BG,
            fg=ModernTheme.ACCENT_BLUE,
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
            command=lambda: self.url_var.set("https://browserleaks.com/canvas")
        )
        btn_test.pack(side=tk.LEFT)

        # 3. PROFILES TABLE (TREEVIEW)
        table_container = tk.Frame(self.root, bg=ModernTheme.BG_DARK, padx=20, pady=5)
        table_container.pack(fill=tk.BOTH, expand=True)

        columns = ("name", "hardware", "canvas_seed", "proxy", "status")
        self.tree = ttk.Treeview(table_container, columns=columns, show="headings", selectmode="browse")

        self.tree.heading("name", text="Nama Profil", anchor=tk.W)
        self.tree.heading("hardware", text="Emulasi Hardware & OS", anchor=tk.W)
        self.tree.heading("canvas_seed", text="Canvas Seed", anchor=tk.CENTER)
        self.tree.heading("proxy", text="Proxy", anchor=tk.W)
        self.tree.heading("status", text="Status", anchor=tk.CENTER)

        self.tree.column("name", width=180, anchor=tk.W)
        self.tree.column("hardware", width=340, anchor=tk.W)
        self.tree.column("canvas_seed", width=110, anchor=tk.CENTER)
        self.tree.column("proxy", width=160, anchor=tk.W)
        self.tree.column("status", width=120, anchor=tk.CENTER)

        # Scrollbar
        scrollbar = ttk.Scrollbar(table_container, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Double click to launch
        self.tree.bind("<Double-1>", lambda event: self._launch_selected_profile())

        # 4. BOTTOM ACTION CONTROL BAR
        bottom_frame = tk.Frame(self.root, bg=ModernTheme.PANEL_BG, padx=20, pady=12)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM)

        btn_launch = tk.Button(
            bottom_frame,
            text="▶ Buka Browser Terpilih",
            font=(ModernTheme.FONT_FAMILY, 10, "bold"),
            bg=ModernTheme.ACCENT_GREEN,
            fg="#ffffff",
            activebackground=ModernTheme.ACCENT_GREEN_HOVER,
            activeforeground="#ffffff",
            relief="flat",
            padx=16,
            pady=8,
            cursor="hand2",
            command=self._launch_selected_profile
        )
        btn_launch.pack(side=tk.LEFT, padx=(0, 10))

        btn_stop = tk.Button(
            bottom_frame,
            text="⏹ Hentikan Browser",
            font=(ModernTheme.FONT_FAMILY, 10),
            bg=ModernTheme.ACCENT_RED,
            fg="#ffffff",
            activebackground=ModernTheme.ACCENT_RED_HOVER,
            activeforeground="#ffffff",
            relief="flat",
            padx=14,
            pady=8,
            cursor="hand2",
            command=self._stop_selected_profile
        )
        btn_stop.pack(side=tk.LEFT, padx=(0, 10))

        btn_open_folder = tk.Button(
            bottom_frame,
            text="📁 Buka Folder Data",
            font=(ModernTheme.FONT_FAMILY, 10),
            bg=ModernTheme.CARD_BG,
            fg=ModernTheme.TEXT_MAIN,
            relief="flat",
            padx=12,
            pady=8,
            cursor="hand2",
            command=self._open_profile_folder
        )
        btn_open_folder.pack(side=tk.LEFT, padx=(0, 10))

        btn_delete = tk.Button(
            bottom_frame,
            text="🗑 Hapus Profil",
            font=(ModernTheme.FONT_FAMILY, 10),
            bg=ModernTheme.CARD_BG,
            fg=ModernTheme.ACCENT_RED,
            relief="flat",
            padx=12,
            pady=8,
            cursor="hand2",
            command=self._delete_selected_profile
        )
        btn_delete.pack(side=tk.RIGHT)

    def _refresh_profile_list(self):
        """Reload profiles from disk and populate treeview."""
        for item in self.tree.get_children():
            self.tree.delete(item)

        profiles = self.profile_mgr.list_profiles()
        active_count = 0

        for p in profiles:
            name = p.get("name", "Unknown")
            is_active = name in self.active_processes and self.active_processes[name].poll() is None
            if is_active:
                active_count += 1
                status = f"● Aktif (PID {self.active_processes[name].pid})"
            else:
                status = "○ Siap"

            renderer = p.get("webgl_renderer", "Default")
            # Shorten renderer display text for readability
            if "RTX 3070" in renderer:
                hw_display = "Windows 10 | NVIDIA RTX 3070"
            elif "RTX 4080" in renderer:
                hw_display = "Windows 10 | NVIDIA RTX 4080"
            elif "Iris" in renderer:
                hw_display = "Windows 10 | Intel Iris Xe"
            elif "Apple M2" in renderer:
                hw_display = "macOS | Apple M2"
            else:
                hw_display = p.get("platform", "Win32") + " | " + renderer[:30]

            proxy_display = p.get("proxy") or "Koneksi Langsung (Direct)"
            canvas_seed = str(p.get("canvas_seed", "-"))

            self.tree.insert("", tk.END, iid=name, values=(name, hw_display, canvas_seed, proxy_display, status))

        self.stats_lbl.config(text=f"Total Profil: {len(profiles)} | Aktif: {active_count}")

    def _get_selected_profile_name(self) -> Optional[str]:
        selected = self.tree.selection()
        if not selected:
            messagebox.showwarning("Peringatan", "Pilih profil dari tabel terlebih dahulu.")
            return None
        return selected[0]

    def _launch_selected_profile(self):
        profile_name = self._get_selected_profile_name()
        if not profile_name:
            return

        if profile_name in self.active_processes and self.active_processes[profile_name].poll() is None:
            messagebox.showinfo("Informasi", f"Profil '{profile_name}' sudah berjalan.")
            return

        target_url = self.url_var.get().strip() or "https://browserleaks.com/canvas"

        try:
            proc = self.launcher.launch(profile_name=profile_name, target_url=target_url)
            self.active_processes[profile_name] = proc
            self._refresh_profile_list()
        except Exception as e:
            messagebox.showerror("Error Peluncuran", f"Gagal menjalankan browser:\n{str(e)}")

    def _stop_selected_profile(self):
        profile_name = self._get_selected_profile_name()
        if not profile_name:
            return

        proc = self.active_processes.get(profile_name)
        if proc and proc.poll() is None:
            proc.terminate()
            del self.active_processes[profile_name]
            messagebox.showinfo("Sukses", f"Browser profil '{profile_name}' telah dihentikan.")
            self._refresh_profile_list()
        else:
            messagebox.showinfo("Informasi", f"Profil '{profile_name}' tidak sedang berjalan.")

    def _open_profile_folder(self):
        profile_name = self._get_selected_profile_name()
        if not profile_name:
            return

        profile = self.profile_mgr.get_profile(profile_name)
        user_data = profile.get("user_data_dir")
        if user_data and os.path.exists(user_data):
            os.startfile(user_data)
        else:
            messagebox.showwarning("Peringatan", "Direktori UserData profil belum dibuat.")

    def _delete_selected_profile(self):
        profile_name = self._get_selected_profile_name()
        if not profile_name:
            return

        if profile_name in self.active_processes and self.active_processes[profile_name].poll() is None:
            messagebox.showwarning("Peringatan", "Hentikan browser terlebih dahulu sebelum menghapus profil.")
            return

        confirm = messagebox.askyesno("Konfirmasi Hapus", f"Apakah Anda yakin ingin menghapus profil '{profile_name}'?")
        if confirm:
            self.profile_mgr.delete_profile(profile_name)
            self._refresh_profile_list()

    def _check_process_status(self):
        """Periodically checks if opened browsers were closed directly by the user."""
        dirty = False
        to_remove = []
        for name, proc in self.active_processes.items():
            if proc.poll() is not None:
                to_remove.append(name)
                dirty = True

        for name in to_remove:
            del self.active_processes[name]

        if dirty:
            self._refresh_profile_list()

        self.root.after(1000, self._check_process_status)

    def _show_create_profile_dialog(self):
        """Popup dialog to configure and create a new identity profile."""
        dlg = tk.Toplevel(self.root)
        dlg.title("Buat Profil Baru")
        dlg.geometry("480x380")
        dlg.resizable(False, False)
        dlg.configure(bg=ModernTheme.PANEL_BG)
        dlg.transient(self.root)
        dlg.grab_set()

        # Center dialog
        dlg.update_idletasks()
        x = self.root.winfo_x() + (self.root.winfo_width() // 2) - 240
        y = self.root.winfo_y() + (self.root.winfo_height() // 2) - 190
        dlg.geometry(f"+{x}+{y}")

        title = tk.Label(
            dlg,
            text="Konfigurasi Profil Identitas Baru",
            font=(ModernTheme.FONT_FAMILY, 12, "bold"),
            bg=ModernTheme.PANEL_BG,
            fg=ModernTheme.TEXT_MAIN,
            pady=10
        )
        title.pack()

        form_frame = tk.Frame(dlg, bg=ModernTheme.PANEL_BG, padx=25)
        form_frame.pack(fill=tk.BOTH, expand=True)

        # Name
        tk.Label(form_frame, text="Nama Profil:", font=(ModernTheme.FONT_FAMILY, 10), bg=ModernTheme.PANEL_BG, fg=ModernTheme.TEXT_MUTED).grid(row=0, column=0, sticky=tk.W, pady=8)
        name_var = tk.StringVar(value=f"profil_{len(self.profile_mgr.list_profiles()) + 1}")
        name_entry = tk.Entry(form_frame, textvariable=name_var, font=(ModernTheme.FONT_FAMILY, 10), bg=ModernTheme.CARD_BG, fg=ModernTheme.TEXT_MAIN, insertbackground=ModernTheme.TEXT_MAIN, relief="flat", width=28)
        name_entry.grid(row=0, column=1, sticky=tk.W, pady=8, ipady=4)

        # Preset Hardware
        tk.Label(form_frame, text="Hardware Preset:", font=(ModernTheme.FONT_FAMILY, 10), bg=ModernTheme.PANEL_BG, fg=ModernTheme.TEXT_MUTED).grid(row=1, column=0, sticky=tk.W, pady=8)
        preset_names = [
            "Windows 10 | NVIDIA RTX 3070 (8-Core)",
            "Windows 10 | NVIDIA RTX 4080 (16-Core)",
            "Windows 10 | Intel Iris Xe (8-Core)",
            "macOS 14 | Apple M2 (8-Core)"
        ]
        preset_combo = ttk.Combobox(form_frame, values=preset_names, state="readonly", width=27, font=(ModernTheme.FONT_FAMILY, 9))
        preset_combo.current(0)
        preset_combo.grid(row=1, column=1, sticky=tk.W, pady=8)

        # Proxy
        tk.Label(form_frame, text="Proxy (Opsional):", font=(ModernTheme.FONT_FAMILY, 10), bg=ModernTheme.PANEL_BG, fg=ModernTheme.TEXT_MUTED).grid(row=2, column=0, sticky=tk.W, pady=8)
        proxy_var = tk.StringVar()
        proxy_entry = tk.Entry(form_frame, textvariable=proxy_var, font=(ModernTheme.FONT_FAMILY, 10), bg=ModernTheme.CARD_BG, fg=ModernTheme.TEXT_MAIN, insertbackground=ModernTheme.TEXT_MAIN, relief="flat", width=28)
        proxy_entry.grid(row=2, column=1, sticky=tk.W, pady=8, ipady=4)

        hint_lbl = tk.Label(
            form_frame,
            text="Format: http://host:port atau socks5://host:port",
            font=(ModernTheme.FONT_FAMILY, 8),
            bg=ModernTheme.PANEL_BG,
            fg=ModernTheme.TEXT_MUTED
        )
        hint_lbl.grid(row=3, column=1, sticky=tk.W)

        # Buttons
        btn_frame = tk.Frame(dlg, bg=ModernTheme.PANEL_BG, pady=15)
        btn_frame.pack(fill=tk.X)

        def save():
            name = name_var.get().strip()
            if not name:
                messagebox.showerror("Error", "Nama profil tidak boleh kosong.", parent=dlg)
                return
            idx = preset_combo.current()
            proxy = proxy_var.get().strip()
            self.profile_mgr.create_profile(name=name, preset_index=idx, proxy=proxy if proxy else None)
            self._refresh_profile_list()
            dlg.destroy()

        btn_save = tk.Button(
            btn_frame,
            text="Simpan Profil",
            font=(ModernTheme.FONT_FAMILY, 10, "bold"),
            bg=ModernTheme.ACCENT_BLUE,
            fg="#ffffff",
            activebackground=ModernTheme.ACCENT_BLUE_HOVER,
            relief="flat",
            padx=16,
            pady=6,
            cursor="hand2",
            command=save
        )
        btn_save.pack(side=tk.RIGHT, padx=25)

        btn_cancel = tk.Button(
            btn_frame,
            text="Batal",
            font=(ModernTheme.FONT_FAMILY, 10),
            bg=ModernTheme.CARD_BG,
            fg=ModernTheme.TEXT_MAIN,
            relief="flat",
            padx=14,
            pady=6,
            cursor="hand2",
            command=dlg.destroy
        )
        btn_cancel.pack(side=tk.RIGHT, padx=(0, 10))


def main():
    root = tk.Tk()
    app = StealthBrowserGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
