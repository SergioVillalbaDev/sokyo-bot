# ⚠️ Esta rama (`main`) está ABANDONADA — no trabajes aquí

El bot de verdad (casino, mascotas, compañeros, cartas, granja, pase, niveles, panel nuevo…)
está en la rama **`feature/frontend-redesign`**. Es la que despliega la Raspberry Pi
(dashboard.sokyo.studio). `main` se quedó en una versión antigua con solo tickets,
`!dado`, `!moneda`, `!user` y `!setupSoporte`: si buscas algo aquí y «no existe», es por esto.

**Antes de hacer nada, cámbiate a la rama buena y lee su CLAUDE.md:**

```bash
git fetch origin feature/frontend-redesign
git checkout -B <tu-rama-de-trabajo> origin/feature/frontend-redesign
cat CLAUDE.md
```

- Los cambios van en una rama propia → PR contra **`feature/frontend-redesign`** (nunca contra `main`).
- El `CLAUDE.md` de esa rama explica cómo está hecho todo, cómo se prueba y cómo se despliega.
- Para que esto no haga falta: en GitHub, *Settings → General → Default branch*, poner
  `feature/frontend-redesign` como rama por defecto (así las sesiones nuevas ya la clonan).
