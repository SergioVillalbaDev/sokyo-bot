"""Registro de todo lo que hace el bot: log en pantalla/archivo, diario de operaciones y avisos.

- LOG (resultados/bot_<modo>.log): cada decisión, con fecha y hora. Si algo raro pasa,
  aquí puedes ver exactamente qué pensó el bot.
- DIARIO DE OPERACIONES (resultados/operaciones_<modo>.csv): cada compra y venta.
  Se abre con Excel o Google Sheets. Te servirá para la declaración de la renta.
- TELEGRAM (opcional): te manda un mensaje al móvil cuando compra, vende o hay un problema.
"""
from __future__ import annotations

import csv
import logging
import os
from dataclasses import asdict

import requests

from .config import RAIZ
from .cuenta import Operacion

CARPETA = RAIZ / "resultados"


def configurar_log(modo: str) -> logging.Logger:
    CARPETA.mkdir(parents=True, exist_ok=True)
    log = logging.getLogger("bot")
    log.setLevel(logging.INFO)
    if not log.handlers:
        from rich.logging import RichHandler

        pantalla = RichHandler(show_path=False, markup=False, log_time_format="%d/%m %H:%M:%S")
        log.addHandler(pantalla)
        archivo = logging.FileHandler(CARPETA / f"bot_{modo}.log", encoding="utf-8")
        archivo.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-7s %(message)s", "%Y-%m-%d %H:%M:%S"))
        log.addHandler(archivo)
    return log


def anotar_operacion(op: Operacion, modo: str, simbolo: str) -> None:
    ruta = CARPETA / f"operaciones_{modo}.csv"
    CARPETA.mkdir(parents=True, exist_ok=True)
    fila = {"modo": modo, "simbolo": simbolo, **asdict(op)}
    nuevo = not ruta.exists()
    with open(ruta, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(fila))
        if nuevo:
            w.writeheader()
        w.writerow(fila)


class Notificador:
    """Envía mensajes por Telegram si TELEGRAM_TOKEN y TELEGRAM_CHAT_ID están en .env."""

    def __init__(self, modo: str):
        self.token = os.getenv("TELEGRAM_TOKEN", "").strip()
        self.chat = os.getenv("TELEGRAM_CHAT_ID", "").strip()
        self.prefijo = {"simular": "🧪 SIMULACIÓN", "testnet": "🧪 TESTNET", "real": "💶 REAL"}.get(modo, modo)

    @property
    def activo(self) -> bool:
        return bool(self.token and self.chat)

    def enviar(self, texto: str) -> None:
        if not self.activo:
            return
        try:
            requests.post(f"https://api.telegram.org/bot{self.token}/sendMessage",
                          json={"chat_id": self.chat, "text": f"{self.prefijo}\n{texto}"}, timeout=10)
        except requests.RequestException as e:  # un fallo de Telegram nunca debe parar el bot
            logging.getLogger("bot").warning("No se pudo enviar el aviso de Telegram: %s", e)
