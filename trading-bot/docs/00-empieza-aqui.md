# 00 · Empieza aquí

Bienvenido. Esta guía te lleva de **cero** a tener un bot de trading funcionando con dinero ficticio, entendiendo cada pieza. No hace falta saber nada de trading ni de programación avanzada.

## El plan (unas 4 semanas)

| Semana | Qué haces | Documentos |
|---|---|---|
| 1 | Instalar, aprender los conceptos y lanzar tu primer backtest | 00, 01, 02, 03 |
| 2 | Entender el riesgo y analizar los resultados del backtest. Hacer los ejercicios | 04, 05 |
| 3 | Dejar el bot en **modo simular** (dinero ficticio, precios reales) y vigilarlo | 06, 08 |
| 4 | Pasar al **testnet** de Binance y decidir con datos si pasas a 20 € reales | 06, 07 |

Regla de oro: **no pases a dinero real hasta haber entendido por qué el bot hace cada operación.** Si ves una compra y no sabes explicar por qué la hizo, vuelve a leer.

## Índice

1. [Conceptos básicos](01-conceptos-basicos.md): qué es el trading, BTC, exchange, velas, comisiones...
2. [Cómo funciona el bot](02-como-funciona-el-bot.md): cada archivo del código, explicado
3. [La estrategia](03-estrategia.md): medias móviles y cuándo compra o vende
4. [Gestión del riesgo](04-gestion-del-riesgo.md): lo más importante de todo
5. [Backtesting](05-backtesting.md): probar con el pasado sin engañarse
6. [Paper trading](06-paper-trading.md): simular en directo y el testnet de Binance
7. [Dinero real](07-dinero-real.md): checklist, seguridad e impuestos
8. [Avisos por Telegram](08-avisos-telegram.md)
9. [Glosario](09-glosario.md): todas las palabras raras en un solo sitio
10. [Siguientes pasos](10-siguientes-pasos.md): tenerlo encendido 24/7, mejorar la estrategia, invertir a largo plazo

---

## Instalación paso a paso

### 1. Instalar Python

Python es el lenguaje en el que está escrito el bot.

- **Windows**: descárgalo de [python.org/downloads](https://www.python.org/downloads/). Al instalar, **marca la casilla "Add Python to PATH"**.
- **Mac**: descárgalo de la misma web, o con Homebrew: `brew install python`.
- **Linux**: normalmente ya viene. Si no: `sudo apt install python3 python3-venv`.

Comprueba que funciona abriendo una **terminal** (en Windows: busca "PowerShell"; en Mac: "Terminal") y escribiendo:

```bash
python --version
```

Debe salir algo como `Python 3.12.x` (vale la 3.10 o superior). En Mac/Linux a veces hay que escribir `python3` en lugar de `python`.

> **¿Qué es la terminal?** Una ventana donde le das órdenes al ordenador escribiendo. Para moverte a una carpeta se usa `cd nombre-carpeta`. Para ver qué hay dentro: `ls` (Mac/Linux) o `dir` (Windows).

### 2. Descargar el proyecto

Si tienes Git:

```bash
git clone https://github.com/SergioVillalbaDev/sokyo-bot.git
cd sokyo-bot/trading-bot
```

Si no, descarga el ZIP desde GitHub (botón verde "Code" → "Download ZIP"), descomprímelo y entra en la carpeta `trading-bot` con `cd`.

### 3. Crear un entorno virtual (recomendado)

Un **entorno virtual** es una carpeta aislada con las librerías de este proyecto, para no mezclarlas con otras cosas de tu ordenador.

```bash
python -m venv .venv
```

Actívalo (hay que hacerlo cada vez que abras una terminal nueva):

- Windows: `.venv\Scripts\activate`
- Mac/Linux: `source .venv/bin/activate`

Sabrás que está activo porque la línea de la terminal empieza por `(.venv)`.

### 4. Instalar las librerías

```bash
pip install -r requirements.txt
```

`requirements.txt` es la lista de librerías que usa el bot (cada una está comentada dentro del archivo).

### 5. Comprobar que todo funciona

```bash
python -m pytest -q tests
```

Debe terminar con algo como `26 passed`. Son pruebas automáticas que comprueban que la estrategia, el riesgo y el backtest hacen lo que deben.

### 6. Tu primer backtest

```bash
python -m bot backtest
```

La primera vez tarda medio minuto (descarga ~7 años de precios de BTC). Verás un resumen en pantalla y se creará una carpeta en `resultados/` con un informe, un gráfico y la lista de operaciones. En [05-backtesting.md](05-backtesting.md) se explica cómo leerlo.

### 7. Abrir el panel

```bash
python -m bot panel
```

Se abre una web en tu navegador (http://localhost:8501). Solo funciona en tu ordenador; nadie más puede verla. Desde ahí puedes:

- ver **qué está pensando el bot** ahora mismo, explicado con frases,
- experimentar en el **Laboratorio** moviendo controles (medias, stop, riesgo...) y ver al momento qué habría pasado,
- cambiar la **Configuración** sin tocar archivos,
- leer esta documentación y marcar tu progreso.

Para cerrarlo: `Ctrl + C` en la terminal.

### 8. El bot en directo con dinero ficticio

Abre **otra** terminal (con el entorno virtual activado) y escribe:

```bash
python -m bot simular
```

Se queda funcionando y escribe lo que hace. Para pararlo: `Ctrl + C`. Lo verás en el panel, en la página **Bot en directo**, o con `python -m bot estado simular`.

---

## Resumen de comandos

| Comando | Qué hace |
|---|---|
| `python -m bot panel` | Abre el panel web en el navegador |
| `python -m bot backtest` | Prueba la estrategia con datos desde 2020 |
| `python -m bot backtest --robustez` | Igual, y además prueba muchas variantes para ver si el resultado es estable |
| `python -m bot backtest --desde 2022-01-01 --hasta 2024-01-01` | Backtest de un periodo concreto |
| `python -m bot simular` | Bot en directo, dinero ficticio, sin cuenta |
| `python -m bot testnet` | Bot en directo en el testnet de Binance (necesita claves de testnet) |
| `python -m bot real` | Bot con dinero real (bloqueado hasta que lo actives tú) |
| `python -m bot estado simular` | Ver saldo, posición y últimas operaciones |
| `python -m bot reiniciar simular` | Borrar la simulación y empezar de cero |
| `python -m bot simular --una-vez` | Hacer una sola revisión y salir |
