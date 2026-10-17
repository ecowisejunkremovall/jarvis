exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { images, customer, notes, distance_miles, hp } = body;

    if (hp) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'Request processed' }) };
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'No images provided' }) };
    }

    // Extracción y Normalización de Datos del Cliente y Ubicación
    const clientName = customer?.name || 'Estimado Cliente';
    const clientPhone = customer?.phone || 'No proporcionado';
    const clientEmail = customer?.email || 'No proporcionado';
    const clientAddress = customer?.address || 'Austin, TX';
    
    // Cálculo de Distancia y Recargo por Milla
    // Regla de Empresa Grande: 10 millas libres; $3.00/milla adicional por desgaste, diésel/gasolina y peajes en Austin (130 / 45 Toll)
    const miles = parseFloat(distance_miles || customer?.miles || 0);
    const mileageFee = miles > 10 ? Math.round((miles - 10) * 3.00) : 0;

    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'GEMINI_API_KEY missing' }) };
    }

    // PROMPT SYSTEM: JARVIS PRO V7 - ENTERPRISE COMMERCIAL PRICING & LOGISTICS AGENT
    const systemPrompt = `
You are JARVIS, the hyper-intelligent enterprise pricing and logistics agent for EcoWise Junk Removal in Austin, Texas.
Your job is to generate a 100% TRANSPARENT, HYPER-ACCURATE, ITEM-BY-ITEM COMMERCIAL QUOTE.
You emulate the pricing models of top national franchises (1-800-GOT-JUNK, Junk King) to guarantee EcoWise NEVER loses money while building maximum client trust.

AUSTIN REGIONAL TRAILER / TRUCK BED BASE VOLUME MATRIX (12ft L x 8ft W x 4ft H Commercial Rig):
- "single": Minimum Load / 1-2 Items -> Base $95 (Labor & min disposal)
- "quarter": 1/4 Trailer (~4 cu. yds / 100 cu. ft) -> Base $195
- "half": 1/2 Trailer (~8 cu. yds / 200 cu. ft) -> Base $335
- "three_quarter": 3/4 Trailer (~12 cu. yds / 300 cu. ft) -> Base $485
- "full": Full Trailer (~16 cu. yds / 400+ cu. ft) -> Base $650

MANDATORY AUSTIN LANDFILL TIPPING FEES & ITEM GATE RATES (TDS / TRAVIS COUNTY LANDFILL):
- General Trash Disposal: Factored into base volume ($85/ton average scale tipping rate).
- Paint Solidification Fee (Latex/Oil): +$15 per gallon/can (Cost of Cat Litter / Sand absorbent + hazard drying labor time to meet Austin landfill solid-waste mandates).
- TV / CRT / Big Screen / Monitor E-Waste Gate Fee: +$35 each
- Laptops / Desktops / Printers E-Waste Fee: +$20 each
- Mattress / Boxspring Gate Surcharge: +$45 each (Sanitization fee)
- Refrigerator / Freezer / AC Unit EPA Freon Fee: +$70 each (EPA certification recovery)
- Heavy Washer / Dryer / Appliance Fee: +$40 each
- Off-Road or Large Tires: +$25 each
- Heavy Density Weight Override (CONCRETE, DIRT, BRICK, TILE, ROOFING, MASONRY, GRAVEL):
  Set "is_heavy_density": true. Charge weight-adjusted scale rates (Minimum +$160 per estimated ton).

DISTANCE & FUEL SURCHARGE:
- Calculated Mileage Fee: $${mileageFee} (${miles} miles total; 10 free miles included, $3.00/mi thereafter for fuel, tolls, and driver time).

ECO DIVERSION CREDIT (DONATION / RECYCLING):
- Apply "eco_credit" (-$20 to -$40) if items qualify for donation (Habitat ReStore / Goodwill) or scrap metal recycling (CMC Recycling), reducing landfill tipping costs.

COMMERCIAL SAFETY & TRAFFIC BUFFER:
- Apply a strict 22% "fuel_traffic_labor_buffer" on the subtotal to cover Austin traffic delays (I-35, Mopac), landfill wait times, and hidden load depth.

Return ONLY a raw JSON object matching this schema (NO markdown formatting, NO backticks):
{
  "customer": {
    "name": "${clientName}",
    "phone": "${clientPhone}",
    "email": "${clientEmail}",
    "address": "${clientAddress}",
    "miles_calculated": ${miles}
  },
  "volume_category": "single" | "quarter" | "half" | "three_quarter" | "full",
  "cubic_yards_estimated": 8,
  "is_heavy_density": false,
  "detected_items": [{"item": "string", "qty": 1}],
  "transparent_invoice_breakdown": {
    "base_trailer_volume_fee": 335,
    "distance_mileage_surcharge": ${mileageFee},
    "landfill_and_item_fees": {
      "e_waste_gate_fee": 0,
      "paint_solidification_cat_litter_fee": 0,
      "freon_epa_fee": 0,
      "mattress_sanitization_fee": 0,
      "heavy_material_weight_fee": 0,
      "subtotal_landfill_fees": 0
    },
    "eco_donation_recycling_credit": 0,
    "fuel_traffic_labor_buffer_22pct": 73,
    "total_exact_quote": 408,
    "recommended_range": {
      "min": 395,
      "max": 425
    }
  },
  "jarvis_invoice_summary_spanish": "Factura detallada en español explicando cada rubro: costo base de traila, millas, fees de botadero de Austin, tratamiento de pintura con cat litter y crédito de donación.",
  "jarvis_invoice_summary_english": "Itemized invoice summary in English detailing base volume, mileage surcharge, landfill gate fees, and eco-credits.",
  "client_instructions": "Instrucciones de confirmación y preparación del trabajo para ${clientName}.",
  "notes_considered": "${notes || 'None'}"
}
`;

    const contentsParts = images.map((base64Data) => {
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      return { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } };
    });

    contentsParts.push({ text: systemPrompt });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: contentsParts }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return { statusCode: geminiResponse.status, body: JSON.stringify({ ok: false, error: errText }) };
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedEstimate = JSON.parse(rawText);

    // AUTO-SYNC CON BASE44 (ECOWISE CENTRAL)
    const base44ApiUrl = process.env.BASE44_API_URL;
    const base44ApiKey = process.env.BASE44_API_KEY;

    if (base44ApiUrl && base44ApiKey && clientPhone !== 'No proporcionado') {
      try {
        await fetch(base44ApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${base44ApiKey}`
          },
          body: JSON.stringify({
            client_name: clientName,
            client_phone: clientPhone,
            client_email: clientEmail,
            service_address: clientAddress,
            distance_miles: miles,
            status: "New_Lead_Quoted",
            quote_details: parsedEstimate,
            source: "JARVIS AI Enterprise Engine"
          })
        });
      } catch (e) {
        console.error("Base44 Sync Warning:", e.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ ok: true, data: parsedEstimate })
    };

  } catch (err) {
    console.error('JARVIS Enterprise Engine Error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
