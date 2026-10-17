# Estimador con IA (Google Gemini, gratis) — cómo activarlo

1. Entra a https://aistudio.google.com/apikey con tu cuenta de Google y crea una clave (no pide tarjeta).
2. En Netlify → Site configuration → Environment variables agrega:
   - `GEMINI_API_KEY` = tu clave (obligatoria)
   - `GEMINI_MODEL` (opcional). Por defecto `gemini-3.7-flash`. Alternativas: `gemini-3.5-flash-lite`
     (más ligero, suele dar más volumen gratis) o `gemini-3.8-flash` (más nuevo/preciso).
     En AI Studio → Rate limits ves cuántas solicitudes por minuto y por día te da cada modelo en el plan gratis.
   - `ALLOWED_ORIGINS` (opcional) = https://ecowisejunkremovall.com
3. Publica desde Git o con Netlify CLI (`netlify deploy --prod`). Las funciones normalmente no se
   despliegan arrastrando una carpeta; confírmalo en la documentación de Netlify.
4. Los leads (nombre, teléfono, fotos, ciudad, escaleras, estimado y confianza) llegan a Netlify → Forms → "ai-estimate".
5. Si Gemini llega a su límite gratis o falla, el cliente ve un aviso y puede mandarte la foto por texto
   o usar el formulario de cotización.

## Importante sobre privacidad (plan gratis)
En el plan gratis de la API de Gemini, Google puede usar los textos y fotos para mejorar sus productos, y
revisores humanos podrían leerlos. El plan de pago (pago por uso, con tarifas muy bajas por foto) no los usa
para eso. Por eso el consentimiento de la página ya dice que las fotos las analiza Gemini de Google.
Pide a tus clientes no mostrar personas ni documentos (ya está en los consejos). Revisa tu aviso de privacidad
y el texto de consentimiento (SMS/llamadas) con tu abogado. Si más adelante quieres máxima privacidad,
activa facturación en AI Studio: no cambias el código.

Ajusta tus precios en el bloque `CFG` al inicio del script del estimador (index.html y páginas de ciudad).
Las medias cargas (½ y ¾) usan precios interpolados entre ¼ y completo: cámbialos por los tuyos.
La función limita a 3 fotos y 6 solicitudes por IP cada 10 min y no guarda las fotos.

## Si no funciona — diagnóstico en 1 minuto
Abre en el navegador:  https://TU-SITIO/.netlify/functions/estimate?check=1
- **Página 404 / "not found"** → la función no se publicó. Debes publicar desde Git o Netlify CLI, con la carpeta
  `netlify/functions/estimate.js` y el archivo `netlify.toml` en la RAÍZ del proyecto. En Netlify → Functions debe aparecer "estimate".
- **{"hasKey":false}** → falta la variable `GEMINI_API_KEY` (revisa el nombre exacto), o la agregaste y no hiciste un nuevo deploy.
- **{"hasKey":true,"keyWorks":false,"googleStatus":400/403}** → la clave es incorrecta, está mal copiada (sin espacios) o la API no está habilitada.
- **{"keyWorks":true,"chosenModel":"..."}** → todo bien con la clave; prueba el estimador. Si falla con "[timeout]" usa 1–2 fotos o un modelo "flash-lite".
Cuando falla, el mensaje en rojo del estimador trae un código entre corchetes (por ejemplo [HTTP 404] o [HTTP 502 google 403]).
En Netlify → Logs → Functions → estimate ves el detalle del error.

## CHAT DE COTIZACIONES (botón "Chat & Quote")
- Es un asistente propio de la página, **separado de tu sistema interno (EcoWise Central / Base44)**. Ya no se usa ningún iframe de Base44.
- La función `netlify/functions/chat.js` solo puede: (1) llamar a Gemini y (2) leer `pricing.json`. No tiene acceso a bancos, nómina,
  contabilidad, base de datos ni empleados. La IA solo tiene dos herramientas: `calculate_quote` (el precio lo calcula el código, no la IA)
  y `save_lead` (solo con nombre, celular y permiso de contacto). Cualquier precio que la IA escriba y no salga de tu lista se reemplaza.
- **Tus precios están en `pricing.json`** (raíz del sitio). Lo leen el chat y el estimador. Edítalo ahí cuando cambien.
- Los contactos del chat llegan a Netlify → Forms → "chat-lead" (con la conversación y hasta 2 fotos).
- Misma clave `GEMINI_API_KEY`. Opcional: `GEMINI_CHAT_MODEL` (por defecto elige el flash regular más nuevo; si tarda mucho pon uno "flash-lite").
- Diagnóstico: https://ecowisejunkremovall.com/.netlify/functions/chat?check=1
- Asegúrate de que `pricing.json` esté en la RAÍZ del repositorio junto a `netlify.toml`.

## ENVÍO A BASE44 (solo entrada de datos)
Los contactos del chat y del estimador con IA se reenvían a TU app de Base44, **solo para guardarlos** (la página no puede leer nada de Base44).
- Netlify → Environment variables: `BASE44_LEAD_URL` = https://ecowisejunkremovall.base44.app/functions/receiveWebLead
  y `BASE44_LEAD_SECRET` = una clave larga y aleatoria que inventes (la misma que pondrás en Base44 como `WEB_LEAD_SECRET`).
- En Base44 sigue la guía de la carpeta `base44-setup` (entidad `WebLead` + función `receiveWebLead`).
- Diagnóstico: https://ecowisejunkremovall.com/.netlify/functions/lead?check=1  → debe decir base44UrlSet:true y base44SecretSet:true.
- Si Base44 no responde, el contacto igual queda guardado en Netlify → Forms (chat-lead / ai-estimate).
