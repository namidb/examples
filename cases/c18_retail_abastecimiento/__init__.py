"""Caso 18 — Comercio y agroindustria: abastecimiento de la finca a la góndola.

Un retailer grande surte miles de SKU desde decenas de proveedores, por varios
centros de distribución, a decenas de tiendas. El grafo conecta proveedor →
CEDI → tienda → producto (y la demanda, los lotes perecederos, los quiebres y
las sustituciones) para responder lo que a gerencia le quita el sueño:
¿de qué proveedor único dependemos?, ¿qué ventas quedan expuestas si falla un
CEDI?, ¿qué perecedero se pierde en una tienda mientras falta en otra?

Datos sintéticos. Inspirado en el ecosistema real: Corporación Favorita
(Supermaxi/Megamaxi/Akí/Tuti) como retailer y Reybanpac (Grupo Wong: banano,
lácteos, cárnicos) como proveedor agroindustrial integrado.
"""
from cases.common import Rng, load_edges, load_nodes

HOY = "2026-07-20"
LIMITE_VENCE = "2026-07-22"  # perece en <= 2 días

META = {
    "numero": 18,
    "slug": "retail-abastecimiento",
    "industria": "Comercio y agroindustria — Abastecimiento de la finca a la góndola",
    "titulo": "Que nunca falte en la góndola.",
    "problema": (
        "Un retailer surte miles de SKU desde decenas de proveedores, por "
        "varios centros de distribución, a decenas de tiendas. Cuando un "
        "proveedor o un CEDI falla, nadie ve a tiempo qué tiendas y qué ventas "
        "quedan expuestas; los perecederos se pierden en una tienda mientras "
        "faltan en otra; y no se sabe de qué proveedor único depende la venta."
    ),
    "conecta": [
        "Proveedor", "Centro de distribución", "Tienda", "Producto (SKU)",
        "Categoría", "Demanda por tienda", "Lote perecedero", "Quiebre de stock",
        "Sustitución",
    ],
    "revela": [
        "Ingreso semanal en riesgo por cada proveedor",
        "SKU de proveedor único (punto de falla comercial)",
        "Causa raíz de un desabasto: de un CEDI a las tiendas y ventas expuestas",
        "Merma de perecederos y su redistribución a tiendas en quiebre",
        "Ventas rescatables por sustitución de producto",
    ],
    "indicadores": [
        "Venta semanal de la red", "Ventas perdidas por quiebre",
        "Ingreso en riesgo por proveedor único", "Merma de perecederos evitable",
        "% de quiebres con sustituto disponible",
    ],
    "referencia": (
        "Corporación Favorita (Supermaxi/Megamaxi/Akí, ventas USD 2 546 M en "
        "2024, CEDI en Amaguaña) surte perecederos de proveedores como "
        "Reybanpac (Grupo Wong: banano marca Favorita, lácteos y cárnicos); el "
        "reto es llenar la góndola sin quiebres ni merma."
    ),
}

LEYENDA = {
    "Proveedor": "Quien fabrica o cultiva el producto",
    "Cedi": "Centro de distribución regional",
    "Tienda": "Local de venta (formato megamaxi…tuti)",
    "Producto": "SKU vendible",
    "Categoria": "Familia comercial del SKU",
    "Lote": "Tanda física de un perecedero, con vencimiento",
    "Quiebre": "Evento de desabasto en una tienda",
}

# ── Catálogo de productos (sku, nombre, categoria, perecedero, vida_util, precio) ──
PRODUCTOS = [
    ("SKU-001", "Banano premium", "Frutas", True, 7, 0.85),
    ("SKU-002", "Banano orgánico", "Frutas", True, 7, 1.20),
    ("SKU-003", "Leche entera 1L", "Lácteos", True, 5, 1.10),
    ("SKU-004", "Leche deslactosada 1L", "Lácteos", True, 5, 1.35),
    ("SKU-005", "Queso fresco 500g", "Lácteos", True, 10, 3.90),
    ("SKU-006", "Yogurt natural 1L", "Lácteos", True, 12, 2.40),
    ("SKU-007", "Mantequilla 250g", "Lácteos", True, 30, 2.80),
    ("SKU-008", "Carne de res kg", "Cárnicos", True, 4, 6.50),
    ("SKU-009", "Pollo entero kg", "Cárnicos", True, 3, 3.20),
    ("SKU-010", "Cerdo kg", "Cárnicos", True, 4, 5.10),
    ("SKU-011", "Chorizo 400g", "Cárnicos", True, 15, 3.60),
    ("SKU-012", "Pan de molde", "Panadería", True, 3, 1.80),
    ("SKU-013", "Pan baguette", "Panadería", True, 2, 1.10),
    ("SKU-014", "Huevos 30u", "Frutas", True, 20, 4.20),
    ("SKU-015", "Camarón kg", "Cárnicos", True, 6, 8.90),
    ("SKU-016", "Tilapia kg", "Cárnicos", True, 5, 5.50),
    ("SKU-017", "Manzana kg", "Frutas", True, 20, 2.10),
    ("SKU-018", "Tomate kg", "Frutas", True, 8, 1.30),
    ("SKU-019", "Arroz 2kg", "Abarrotes", False, 365, 2.60),
    ("SKU-020", "Arroz marca propia 2kg", "Abarrotes", False, 365, 2.10),
    ("SKU-021", "Azúcar 2kg", "Abarrotes", False, 365, 2.30),
    ("SKU-022", "Fideo 400g", "Abarrotes", False, 365, 0.95),
    ("SKU-023", "Aceite 1L", "Abarrotes", False, 365, 2.75),
    ("SKU-024", "Harina 1kg", "Abarrotes", False, 365, 1.40),
    ("SKU-025", "Atún lata", "Abarrotes", False, 730, 1.60),
    ("SKU-026", "Café molido 500g", "Abarrotes", False, 365, 6.80),
    ("SKU-027", "Café orgánico 500g", "Abarrotes", False, 365, 9.20),
    ("SKU-028", "Chocolate barra", "Abarrotes", False, 365, 2.20),
    ("SKU-029", "Gaseosa 3L", "Bebidas", False, 180, 1.90),
    ("SKU-030", "Agua 6L", "Bebidas", False, 365, 1.70),
    ("SKU-031", "Jugo 1L", "Bebidas", False, 120, 1.50),
    ("SKU-032", "Cerveza sixpack", "Bebidas", False, 180, 5.40),
    ("SKU-033", "Detergente 3kg", "Limpieza", False, 730, 6.20),
    ("SKU-034", "Jabón 3u", "Limpieza", False, 730, 2.10),
    ("SKU-035", "Papel higiénico 12u", "Limpieza", False, 730, 5.80),
    ("SKU-036", "Cloro 1L", "Limpieza", False, 365, 1.30),
    ("SKU-037", "Fréjol 500g", "Abarrotes", False, 365, 1.85),
    ("SKU-038", "Lenteja 500g", "Abarrotes", False, 365, 1.75),
    ("SKU-039", "Sal 1kg", "Abarrotes", False, 730, 0.70),
    ("SKU-040", "Mermelada 300g", "Abarrotes", False, 365, 2.40),
]
PRECIO = {p[0]: p[5] for p in PRODUCTOS}
# Demanda base por SKU (unidades/semana en una tienda "supermaxi" típica).
DEMANDA_BASE = {
    "SKU-001": 900, "SKU-002": 320, "SKU-003": 820, "SKU-004": 300, "SKU-005": 260,
    "SKU-006": 240, "SKU-007": 150, "SKU-008": 210, "SKU-009": 380, "SKU-010": 140,
    "SKU-011": 120, "SKU-012": 340, "SKU-013": 300, "SKU-014": 420, "SKU-015": 90,
    "SKU-016": 110, "SKU-017": 280, "SKU-018": 500, "SKU-019": 260, "SKU-020": 300,
    "SKU-021": 240, "SKU-022": 300, "SKU-023": 200, "SKU-024": 180, "SKU-025": 260,
    "SKU-026": 90, "SKU-027": 40, "SKU-028": 220, "SKU-029": 360, "SKU-030": 300,
    "SKU-031": 260, "SKU-032": 180, "SKU-033": 120, "SKU-034": 200, "SKU-035": 160,
    "SKU-036": 220, "SKU-037": 150, "SKU-038": 150, "SKU-039": 180, "SKU-040": 120,
}

# ── Proveedores (nombre, tipo, integrado, lead_time_dias) ──
PROVEEDORES = [
    ("Agroindustrial del Pacífico", "agroindustrial", True, 2),   # Reybanpac-like: banano+lácteos+cárnicos
    ("Lácteos Sierra Norte", "lacteo", False, 3),
    ("Frigorífico Andino", "carnicos", False, 2),
    ("Molinos del Litoral", "marca-nacional", False, 5),
    ("Bebidas Nacional", "marca-nacional", False, 4),
    ("Panificadora Real", "marca-nacional", False, 1),
    ("Importadora Global", "importador", False, 20),
    ("Marca Propia CEDI", "marca-propia", False, 3),
    ("Aceites del Trópico", "marca-nacional", False, 6),
    ("Café y Cacao Export", "agroindustrial", False, 4),
    ("Limpieza Total", "marca-nacional", False, 5),
    ("Huevos San Juan", "agroindustrial", False, 2),
    ("Mariscos del Golfo", "importador", False, 7),
    ("Conservas Manabí", "marca-nacional", False, 6),
]

# ── Quién suministra qué (producto -> [proveedores]) ──
# Los de un solo proveedor son "proveedor único" (punto de falla comercial).
SUMINISTRO = {
    "SKU-001": ["Agroindustrial del Pacífico"],                       # único
    "SKU-002": ["Agroindustrial del Pacífico"],                       # único
    "SKU-003": ["Agroindustrial del Pacífico", "Lácteos Sierra Norte"],
    "SKU-004": ["Agroindustrial del Pacífico"],                       # único
    "SKU-005": ["Agroindustrial del Pacífico"],                       # único (queso fresco)
    "SKU-006": ["Lácteos Sierra Norte", "Agroindustrial del Pacífico"],
    "SKU-007": ["Agroindustrial del Pacífico", "Lácteos Sierra Norte"],
    "SKU-008": ["Agroindustrial del Pacífico", "Frigorífico Andino"],
    "SKU-009": ["Frigorífico Andino"],                               # único (pollo)
    "SKU-010": ["Frigorífico Andino"],                               # único
    "SKU-011": ["Frigorífico Andino"],                               # único
    "SKU-012": ["Panificadora Real"],                               # único
    "SKU-013": ["Panificadora Real"],                               # único
    "SKU-014": ["Huevos San Juan"],                                 # único
    "SKU-015": ["Mariscos del Golfo"],                             # único (camarón)
    "SKU-016": ["Mariscos del Golfo"],                             # único
    "SKU-017": ["Importadora Global"],                             # único (importado, lead largo)
    "SKU-018": ["Agroindustrial del Pacífico", "Marca Propia CEDI"],
    "SKU-019": ["Molinos del Litoral", "Marca Propia CEDI"],
    "SKU-020": ["Marca Propia CEDI"],
    "SKU-021": ["Molinos del Litoral", "Marca Propia CEDI"],
    "SKU-022": ["Molinos del Litoral"],
    "SKU-023": ["Aceites del Trópico"],                             # único
    "SKU-024": ["Molinos del Litoral", "Marca Propia CEDI"],
    "SKU-025": ["Conservas Manabí"],
    "SKU-026": ["Café y Cacao Export"],                             # único
    "SKU-027": ["Café y Cacao Export"],                             # único (café orgánico)
    "SKU-028": ["Café y Cacao Export"],
    "SKU-029": ["Bebidas Nacional"],
    "SKU-030": ["Bebidas Nacional"],
    "SKU-031": ["Bebidas Nacional"],
    "SKU-032": ["Bebidas Nacional"],
    "SKU-033": ["Limpieza Total"],
    "SKU-034": ["Limpieza Total", "Marca Propia CEDI"],
    "SKU-035": ["Importadora Global"],                             # único (papel h. importado)
    "SKU-036": ["Limpieza Total"],
    "SKU-037": ["Molinos del Litoral"],
    "SKU-038": ["Molinos del Litoral"],
    "SKU-039": ["Marca Propia CEDI"],
    "SKU-040": ["Conservas Manabí"],
}

# ── Centros de distribución (nombre, ciudad, region, capacidad_pallets) ──
CEDIS = [
    ("CEDI Amaguaña", "Quito", "sierra", 9000),
    ("CEDI Durán", "Guayaquil", "costa", 8000),
    ("CEDI Cuenca", "Cuenca", "austro", 4000),
    ("CEDI Manta", "Manta", "manabi", 3000),
]
# Cada proveedor entrega en estos CEDIs.
ENTREGA = {
    "Agroindustrial del Pacífico": ["CEDI Amaguaña", "CEDI Durán", "CEDI Cuenca", "CEDI Manta"],
    "Lácteos Sierra Norte": ["CEDI Amaguaña", "CEDI Cuenca"],
    "Frigorífico Andino": ["CEDI Amaguaña", "CEDI Durán"],
    "Molinos del Litoral": ["CEDI Durán", "CEDI Manta"],
    "Bebidas Nacional": ["CEDI Amaguaña", "CEDI Durán", "CEDI Cuenca", "CEDI Manta"],
    "Panificadora Real": ["CEDI Amaguaña", "CEDI Durán"],
    "Importadora Global": ["CEDI Durán"],                # solo por puerto (ruta única)
    "Marca Propia CEDI": ["CEDI Amaguaña", "CEDI Durán", "CEDI Cuenca", "CEDI Manta"],
    "Aceites del Trópico": ["CEDI Durán"],
    "Café y Cacao Export": ["CEDI Amaguaña", "CEDI Manta"],
    "Limpieza Total": ["CEDI Amaguaña", "CEDI Durán"],
    "Huevos San Juan": ["CEDI Amaguaña", "CEDI Cuenca"],
    "Mariscos del Golfo": ["CEDI Durán", "CEDI Manta"],
    "Conservas Manabí": ["CEDI Durán", "CEDI Manta"],
}

# ── Tiendas (nombre, formato, ciudad, region) ──
TIENDAS = [
    ("Megamaxi Quito Norte", "megamaxi", "Quito", "sierra"),
    ("Megamaxi Guayaquil Centro", "megamaxi", "Guayaquil", "costa"),
    ("Supermaxi Cumbayá", "supermaxi", "Quito", "sierra"),
    ("Supermaxi Quito Sur", "supermaxi", "Quito", "sierra"),
    ("Supermaxi Los Ceibos", "supermaxi", "Guayaquil", "costa"),
    ("Supermaxi Samborondón", "supermaxi", "Guayaquil", "costa"),
    ("Supermaxi Cuenca Centro", "supermaxi", "Cuenca", "austro"),
    ("Supermaxi Manta", "supermaxi", "Manta", "manabi"),
    ("Supermaxi Ambato", "supermaxi", "Ambato", "sierra"),
    ("Akí Machala", "aki", "Machala", "costa"),
    ("Akí Portoviejo", "aki", "Portoviejo", "manabi"),
    ("Akí Santo Domingo", "aki", "Santo Domingo", "costa"),
    ("Akí Quevedo", "aki", "Quevedo", "costa"),
    ("Gran Akí Milagro", "gran-aki", "Milagro", "costa"),
    ("Gran Akí Riobamba", "gran-aki", "Riobamba", "sierra"),
    ("Tuti Loja", "tuti", "Loja", "austro"),
    ("Tuti Ibarra", "tuti", "Ibarra", "sierra"),
    ("Tuti Esmeraldas", "tuti", "Esmeraldas", "costa"),
]
# Un CEDI por región abastece a sus tiendas.
CEDI_POR_REGION = {"sierra": "CEDI Amaguaña", "costa": "CEDI Durán",
                   "austro": "CEDI Cuenca", "manabi": "CEDI Manta"}
# Factor de tamaño por formato (multiplica la demanda base).
FACTOR_FORMATO = {"megamaxi": 3.0, "supermaxi": 2.0, "gran-aki": 1.4,
                  "aki": 1.0, "tuti": 0.6}

# ── Sustituciones (sustituto -> agotado) con afinidad ──
SUSTITUCIONES = [
    ("SKU-002", "SKU-001", 0.80),  # banano orgánico ↔ premium
    ("SKU-001", "SKU-002", 0.80),
    ("SKU-004", "SKU-003", 0.75),  # deslactosada ↔ entera
    ("SKU-003", "SKU-004", 0.70),
    ("SKU-020", "SKU-019", 0.85),  # arroz marca propia ↔ arroz
    ("SKU-019", "SKU-020", 0.85),
    ("SKU-024", "SKU-021", 0.30),
    ("SKU-016", "SKU-015", 0.55),  # tilapia ↔ camarón
    ("SKU-010", "SKU-009", 0.60),  # cerdo ↔ pollo
    ("SKU-009", "SKU-008", 0.45),  # pollo ↔ res
    ("SKU-026", "SKU-027", 0.65),  # café molido ↔ orgánico
    ("SKU-013", "SKU-012", 0.60),  # baguette ↔ pan de molde
]

# ── Quiebres activos (tienda, sku, dias) — ventas_perdidas se calcula ──
QUIEBRES = [
    ("Megamaxi Quito Norte", "SKU-005", 3),   # queso fresco (único, alta venta) → redistribuible
    ("Megamaxi Guayaquil Centro", "SKU-003", 2),  # leche entera → sustituto deslactosada
    ("Supermaxi Los Ceibos", "SKU-015", 4),   # camarón (único, sin CEDI redundante)
    ("Supermaxi Cuenca Centro", "SKU-001", 1),  # banano premium (único) → sustituto orgánico
    ("Akí Machala", "SKU-009", 2),            # pollo (único)
    ("Gran Akí Milagro", "SKU-019", 3),       # arroz → sustituto marca propia
    ("Supermaxi Ambato", "SKU-005", 2),       # queso fresco → redistribuible
    ("Megamaxi Quito Norte", "SKU-027", 5),   # café orgánico (único, larga cola)
]

# ── Lotes perecederos por vencer (tienda, sku, unidades, vence) ──
# Plantados: queso fresco y banano venciendo en tiendas de baja rotación
# mientras las de alta rotación están en quiebre del mismo SKU (redistribución).
LOTES_PLANTADOS = [
    ("Tuti Loja", "SKU-005", 60, "2026-07-21"),        # queso fresco → Quito Norte/Ambato en quiebre
    ("Tuti Esmeraldas", "SKU-005", 45, "2026-07-22"),
    ("Tuti Ibarra", "SKU-001", 180, "2026-07-21"),     # banano → Cuenca en quiebre
    ("Akí Portoviejo", "SKU-003", 120, "2026-07-22"),  # leche entera → Guayaquil en quiebre
    ("Gran Akí Riobamba", "SKU-006", 70, "2026-07-22"),
    ("Tuti Loja", "SKU-013", 40, "2026-07-21"),
]


def seed(db):
    rng = Rng(1801)

    productos = [
        {"sku": s, "nombre": n, "categoria": c, "perecedero": per,
         "vida_util": vu, "precio": pr}
        for (s, n, c, per, vu, pr) in PRODUCTOS
    ]
    categorias = [{"nombre": c} for c in sorted({p[2] for p in PRODUCTOS})]
    proveedores = [
        {"nombre": n, "tipo": t, "integrado": ig, "lead_time": lt}
        for (n, t, ig, lt) in PROVEEDORES
    ]
    cedis = [{"nombre": n, "ciudad": ci, "region": r, "capacidad": cap}
             for (n, ci, r, cap) in CEDIS]
    tiendas = [{"nombre": n, "formato": f, "ciudad": ci, "region": r}
               for (n, f, ci, r) in TIENDAS]

    # Aristas de estructura
    suministra = []
    for sku, provs in SUMINISTRO.items():
        for pr in provs:
            suministra.append({"src": pr, "dst": sku, "exclusivo": len(provs) == 1})
    entrega = [{"src": pr, "dst": ce} for pr, ces in ENTREGA.items() for ce in ces]
    abastece = [{"src": CEDI_POR_REGION[r], "dst": n,
                 "dias_transito": rng.randint(1, 3)}
                for (n, _f, _ci, r) in TIENDAS]
    en_categoria = [{"src": p[0], "dst": p[2]} for p in PRODUCTOS]

    # Demanda: cada tienda vende todos los SKU con volumen según formato.
    vende = []
    for (nombre, formato, _ci, _r) in TIENDAS:
        factor = FACTOR_FORMATO[formato]
        for (sku, _n, _c, _per, _vu, precio) in PRODUCTOS:
            base = DEMANDA_BASE[sku] * factor
            jitter = rng.uniform(0.82, 1.18)
            unidades = int(base * jitter)
            if unidades <= 0:
                continue
            vende.append({
                "src": nombre, "dst": sku,
                "unidades_sem": unidades,
                "venta_sem": round(unidades * precio, 2),
            })

    sustituye = [{"src": s, "dst": d, "afinidad": a} for (s, d, a) in SUSTITUCIONES]

    # Quiebres
    quiebres, q_en_tienda, q_de_sku = [], [], []
    for i, (tienda, sku, dias) in enumerate(QUIEBRES, start=1):
        cod = f"Q-{i:03d}"
        # ventas perdidas ≈ demanda diaria de esa tienda × días
        factor = FACTOR_FORMATO[dict((t[0], t[1]) for t in TIENDAS)[tienda]]
        perdida = round(DEMANDA_BASE[sku] * factor / 7 * dias * PRECIO[sku], 2)
        quiebres.append({"codigo": cod, "sku": sku, "dias": dias,
                         "ventas_perdidas": perdida})
        q_en_tienda.append({"src": cod, "dst": tienda})
        q_de_sku.append({"src": cod, "dst": sku})

    # Lotes perecederos: los plantados + fondo determinista
    lotes, l_es_sku, l_en_tienda = [], [], []

    def add_lote(cod, tienda, sku, unidades, vence):
        lotes.append({"codigo": cod, "unidades": unidades, "vence": vence})
        l_es_sku.append({"src": cod, "dst": sku})
        l_en_tienda.append({"src": cod, "dst": tienda})

    n = 1
    for (tienda, sku, unidades, vence) in LOTES_PLANTADOS:
        add_lote(f"L-{n:03d}", tienda, sku, unidades, vence)
        n += 1
    # fondo: lotes sanos (vencen más allá del límite) para dar volumen realista
    perecederos = [p[0] for p in PRODUCTOS if p[3]]
    for (tienda, _f, _ci, _r) in TIENDAS:
        for sku in rng.sample(perecederos, 3):
            add_lote(f"L-{n:03d}", tienda, sku, rng.randint(40, 220),
                     rng.choice(["2026-07-26", "2026-07-29", "2026-08-03"]))
            n += 1

    db.cypher("CREATE CONSTRAINT prod_sku IF NOT EXISTS FOR (p:Producto) REQUIRE p.sku IS UNIQUE")
    db.cypher("CREATE CONSTRAINT prov_nom IF NOT EXISTS FOR (p:Proveedor) REQUIRE p.nombre IS UNIQUE")
    db.cypher("CREATE CONSTRAINT tienda_nom IF NOT EXISTS FOR (t:Tienda) REQUIRE t.nombre IS UNIQUE")

    load_nodes(db, "Producto", productos)
    load_nodes(db, "Categoria", categorias)
    load_nodes(db, "Proveedor", proveedores)
    load_nodes(db, "Cedi", cedis)
    load_nodes(db, "Tienda", tiendas)
    load_nodes(db, "Quiebre", quiebres)
    load_nodes(db, "Lote", lotes)

    load_edges(db, "Proveedor", "nombre", "SUMINISTRA", "Producto", "sku", suministra, rel_props=["exclusivo"])
    load_edges(db, "Proveedor", "nombre", "ENTREGA_EN", "Cedi", "nombre", entrega)
    load_edges(db, "Cedi", "nombre", "ABASTECE", "Tienda", "nombre", abastece, rel_props=["dias_transito"])
    load_edges(db, "Producto", "sku", "EN_CATEGORIA", "Categoria", "nombre", en_categoria)
    load_edges(db, "Tienda", "nombre", "VENDE", "Producto", "sku", vende, rel_props=["unidades_sem", "venta_sem"])
    load_edges(db, "Producto", "sku", "SUSTITUYE_A", "Producto", "sku", sustituye, rel_props=["afinidad"])
    load_edges(db, "Quiebre", "codigo", "EN_TIENDA", "Tienda", "nombre", q_en_tienda)
    load_edges(db, "Quiebre", "codigo", "DE_SKU", "Producto", "sku", q_de_sku)
    load_edges(db, "Lote", "codigo", "ES_SKU", "Producto", "sku", l_es_sku)
    load_edges(db, "Lote", "codigo", "EN_TIENDA", "Tienda", "nombre", l_en_tienda)


QUERIES = [
    {
        "id": "venta-red",
        "titulo": "Pulso de la red",
        "descripcion": (
            "Venta semanal total, SKU en góndola y tiendas conectadas: el "
            "tamaño del negocio que hay que mantener surtido."
        ),
        "cypher": """\
MATCH (t:Tienda)-[v:VENDE]->(p:Producto)
RETURN round(sum(v.venta_sem)) AS venta_semana,
       count(DISTINCT p) AS skus,
       count(DISTINCT t) AS tiendas""",
    },
    {
        "id": "proveedor-critico",
        "titulo": "Ingreso en riesgo por proveedor",
        "descripcion": (
            "Por cada proveedor, la venta semanal de los SKU que suministra, "
            "sumada en todas las tiendas: lo que quedaría expuesto si falla. "
            "El proveedor agroindustrial integrado encabeza."
        ),
        "cypher": """\
MATCH (pr:Proveedor)-[:SUMINISTRA]->(p:Producto)
MATCH (t:Tienda)-[v:VENDE]->(p)
RETURN pr.nombre AS proveedor, pr.tipo AS tipo,
       count(DISTINCT p) AS skus, count(DISTINCT t) AS tiendas,
       round(sum(v.venta_sem)) AS ingreso_en_riesgo
ORDER BY ingreso_en_riesgo DESC""",
    },
    {
        "id": "proveedor-unico",
        "titulo": "SKU de proveedor único",
        "descripcion": (
            "Productos con un solo proveedor: si ese proveedor falla, no hay "
            "plan B. Ordenados por el ingreso semanal que ponen en juego."
        ),
        "cypher": """\
MATCH (p:Producto)<-[:SUMINISTRA]-(pr:Proveedor)
WITH p, count(DISTINCT pr) AS nprov, collect(DISTINCT pr.nombre) AS provs
WHERE nprov = 1
MATCH (t:Tienda)-[v:VENDE]->(p)
RETURN p.nombre AS sku, p.categoria AS categoria, provs[0] AS proveedor,
       count(DISTINCT t) AS tiendas,
       round(sum(v.venta_sem)) AS ingreso_expuesto
ORDER BY ingreso_expuesto DESC""",
    },
    {
        "id": "quiebres-activos",
        "titulo": "Quiebres de stock activos",
        "descripcion": (
            "Desabastos en curso con su venta perdida estimada: dónde se está "
            "yendo la plata en tiempo real."
        ),
        "cypher": """\
MATCH (q:Quiebre)-[:EN_TIENDA]->(t:Tienda)
MATCH (q)-[:DE_SKU]->(p:Producto)
RETURN t.nombre AS tienda, p.nombre AS sku, p.categoria AS categoria,
       q.dias AS dias, round(q.ventas_perdidas) AS ventas_perdidas
ORDER BY ventas_perdidas DESC""",
    },
    {
        "id": "causa-raiz-cedi",
        "titulo": "Causa raíz: si cae un CEDI",
        "descripcion": (
            "Ejercicio de resiliencia sobre CEDI Durán: las tiendas que "
            "abastece y la venta semanal que quedaría expuesta si se detiene."
        ),
        "cypher": """\
MATCH (c:Cedi {nombre: 'CEDI Durán'})-[:ABASTECE]->(t:Tienda)
MATCH (t)-[v:VENDE]->(p:Producto)
RETURN t.nombre AS tienda, t.formato AS formato,
       count(DISTINCT p) AS skus_expuestos,
       round(sum(v.venta_sem)) AS venta_expuesta
ORDER BY venta_expuesta DESC""",
    },
    {
        "id": "sistemico",
        "titulo": "Nodos sistémicos (PageRank)",
        "descripcion": (
            "PageRank sobre toda la cadena proveedor → CEDI → tienda → SKU: "
            "los nodos por los que fluye más de la red. Los CEDIs y los SKU de "
            "amplia distribución emergen como los cuellos de botella sistémicos "
            "— CEDI Durán encabeza, el mismo que expone más venta si se detiene."
        ),
        "cypher": """\
CALL algo.pagerank({labels: ['Proveedor', 'Cedi', 'Tienda', 'Producto'],
                    edge_types: ['SUMINISTRA', 'ENTREGA_EN', 'ABASTECE', 'VENDE']})
YIELD node_id, score
WITH node_id AS nn, score
MATCH (x) WHERE id(x) = id(nn)
RETURN labels(x)[0] AS tipo, coalesce(x.nombre, x.sku) AS nodo,
       round(score * 10000) / 10000 AS pagerank
ORDER BY pagerank DESC LIMIT 12""",
    },
    {
        "id": "merma-perecederos",
        "titulo": "Merma de perecederos por vencer",
        "descripcion": (
            "Lotes que vencen en 48 horas, con el valor en góndola que se "
            "perdería si no se mueven o rematan hoy."
        ),
        "cypher": """\
MATCH (l:Lote)-[:ES_SKU]->(p:Producto)
MATCH (l)-[:EN_TIENDA]->(t:Tienda)
WHERE l.vence <= '2026-07-22'
RETURN t.nombre AS tienda, p.nombre AS sku, l.vence AS vence,
       l.unidades AS unidades, round(l.unidades * p.precio) AS valor_en_riesgo
ORDER BY valor_en_riesgo DESC""",
    },
    {
        "id": "redistribucion",
        "titulo": "Redistribución antes de que venza",
        "descripcion": (
            "El cruce que sólo un grafo hace fácil: un perecedero por vencer en "
            "una tienda de baja rotación mientras otra está en quiebre del mismo "
            "SKU. Mover el stock rescata la venta y evita la merma."
        ),
        "cypher": """\
MATCH (l:Lote)-[:ES_SKU]->(p:Producto)
MATCH (l)-[:EN_TIENDA]->(origen:Tienda)
WHERE l.vence <= '2026-07-22'
MATCH (q:Quiebre)-[:DE_SKU]->(p)
MATCH (q)-[:EN_TIENDA]->(destino:Tienda)
RETURN l.codigo AS lote, p.nombre AS sku, origen.nombre AS desde,
       destino.nombre AS hacia, l.unidades AS unidades, l.vence AS vence,
       round(q.ventas_perdidas) AS demanda_destino,
       round(l.unidades * p.precio) AS venta_rescatable
ORDER BY venta_rescatable DESC, demanda_destino DESC""",
    },
    {
        "id": "sustitucion",
        "titulo": "Rescatar la venta con un sustituto",
        "descripcion": (
            "Para cada quiebre, si existe un producto sustituto en la misma "
            "categoría, la venta no se pierde: se redirige. El grafo de "
            "sustitución dice cuáles quiebres son recuperables."
        ),
        "cypher": """\
MATCH (q:Quiebre)-[:EN_TIENDA]->(t:Tienda)
MATCH (q)-[:DE_SKU]->(p:Producto)
RETURN t.nombre AS tienda, p.nombre AS agotado,
       [(p)<-[:SUSTITUYE_A]-(s:Producto) | s.nombre] AS sustitutos,
       round(q.ventas_perdidas) AS ventas_perdidas
ORDER BY ventas_perdidas DESC""",
    },
    {
        "id": "demanda-formato",
        "titulo": "Venta por formato de tienda",
        "descripcion": (
            "Cómo se reparte la venta semanal entre megamaxi, supermaxi, akí y "
            "tuti: dónde pesa el abastecimiento."
        ),
        "cypher": """\
MATCH (t:Tienda)-[v:VENDE]->(p:Producto)
RETURN t.formato AS formato, count(DISTINCT t) AS tiendas,
       round(sum(v.venta_sem)) AS venta_semana
ORDER BY venta_semana DESC""",
    },
]
