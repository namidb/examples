"""Caso 11 — Comercios: recomendaciones y conocimiento del cliente."""
from cases.common import Rng, embed, load_edges, load_nodes

META = {
    "numero": 11,
    "slug": "recomendaciones",
    "industria": "Comercios y negocios — Recomendaciones y conocimiento del cliente",
    "titulo": "Contexto, no coincidencia.",
    "problema": (
        "Los sistemas comerciales recomiendan “los más vendidos”, sin "
        "comprender relaciones entre intereses, compras, búsquedas, "
        "productos complementarios y contexto del cliente."
    ),
    "conecta": [
        "Cliente", "Producto", "Categoría", "Compras", "Búsquedas",
        "Visitas", "Marcas", "Compatibilidades", "Promociones",
        "Devoluciones", "Opiniones",
    ],
    "revela": [
        "Complementarios y siguiente mejor oferta",
        "Recomendaciones explicables",
        "Segmentos por comportamiento conectado",
        "Menos devoluciones por incompatibilidad",
        "Atención personalizada",
    ],
    "indicadores": [
        "Complementarios y siguiente mejor oferta",
        "Recomendaciones explicables",
        "Segmentos por comportamiento conectado",
        "Menos devoluciones por incompatibilidad",
        "Atención personalizada",
    ],
    "referencia": (
        "eBay opera grafos con miles de millones de entidades; su "
        "recomendador multimodal reportó ~15 % más interacción de compradores."
    ),
}

LEYENDA = {
    "Cliente": "Comprador con historial",
    "Producto": "Artículo del catálogo (con embedding)",
    "Categoria": "Categoría comercial",
    "Marca": "Marca del producto",
    "Busqueda": "Búsqueda textual del cliente",
    "Devolucion": "Devolución registrada y su motivo",
}

# La clienta de la historia y sus productos.
_CLIENTA = "Andrea Villamar"
_CAMARA = "FOT-CAM-Z50"

# Catálogo: (sku, nombre, precio, categoría, marca)
_CATALOGO = [
    # Fotografía — el cluster de la historia
    ("FOT-CAM-Z50", "Cámara Nakura Z50 mirrorless 24MP", 899, "Fotografía", "Nakura"),
    ("FOT-LENTE-50", "Lente 50mm f/1.8 Nakura para retrato", 249, "Fotografía", "Nakura"),
    ("FOT-SD-128", "Tarjeta SD PRO 128GB alta velocidad", 54, "Fotografía", "VoltaPro"),
    ("FOT-MOCHILA", "Mochila fotográfica impermeable para cámara", 89, "Fotografía", "TecnoAndes"),
    ("FOT-TRIPODE", "Trípode de aluminio para cámara", 75, "Fotografía", "TecnoAndes"),
    ("FOT-BAT-Z", "Batería original Nakura BZ-1 para Z50", 59, "Fotografía", "Nakura"),
    ("FOT-BAT-X200", "Batería genérica BAT-X200 para cámara", 19, "Fotografía", "VoltaPro"),
    ("FOT-FILTRO", "Filtro UV 52mm para lente", 25, "Fotografía", "VoltaPro"),
    ("FOT-FLASH", "Flash externo Nakura para zapata", 129, "Fotografía", "Nakura"),
    ("FOT-CORREA", "Correa acolchada para cámara", 18, "Fotografía", "TecnoAndes"),
    # Audio
    ("AUD-AURI-BT", "Audífonos inalámbricos AudioMax Pro", 149, "Audio", "AudioMax"),
    ("AUD-PARLANTE", "Parlante bluetooth resistente al agua", 79, "Audio", "AudioMax"),
    ("AUD-MICRO", "Micrófono de condensador para estudio", 99, "Audio", "AudioMax"),
    ("AUD-INTERFAZ", "Interfaz de audio USB 2 canales", 139, "Audio", "AudioMax"),
    ("AUD-BRAZO", "Brazo articulado para micrófono", 35, "Audio", "TecnoAndes"),
    ("AUD-CABLE-XLR", "Cable XLR balanceado 3 metros", 15, "Audio", "VoltaPro"),
    ("AUD-ESPUMA", "Filtro antipop de espuma para micrófono", 12, "Audio", "AudioMax"),
    # Gaming
    ("GAM-CONSOLA", "Consola PixelForge X 1TB", 499, "Gaming", "PixelForge"),
    ("GAM-CONTROL", "Control inalámbrico PixelForge", 59, "Gaming", "PixelForge"),
    ("GAM-AURI", "Audífonos gamer con micrófono retráctil", 89, "Gaming", "PixelForge"),
    ("GAM-JUEGO-1", "Videojuego Aventura Estelar edición estándar", 69, "Gaming", "PixelForge"),
    ("GAM-JUEGO-2", "Videojuego Carreras Extremas", 69, "Gaming", "PixelForge"),
    ("GAM-SILLA", "Silla gamer ergonómica reclinable", 299, "Gaming", "TecnoAndes"),
    ("GAM-BASE", "Base de carga para controles", 29, "Gaming", "PixelForge"),
    # Computación
    ("COM-LAPTOP", "Laptop TecnoAndes 15 pulgadas 16GB", 999, "Computación", "TecnoAndes"),
    ("COM-MOUSE", "Mouse inalámbrico ergonómico", 29, "Computación", "TecnoAndes"),
    ("COM-TECLADO", "Teclado mecánico retroiluminado", 79, "Computación", "TecnoAndes"),
    ("COM-MONITOR", "Monitor 27 pulgadas 144Hz", 329, "Computación", "TecnoAndes"),
    ("COM-HUB", "Hub USB-C 7 en 1", 45, "Computación", "VoltaPro"),
    ("COM-DISCO", "Disco sólido externo 1TB", 119, "Computación", "VoltaPro"),
    # Viaje y accesorios
    ("VIA-MALETA", "Maleta de viaje rígida 24 pulgadas", 129, "Viaje", "TecnoAndes"),
    ("VIA-MOCHILA-URB", "Mochila urbana para laptop", 59, "Viaje", "TecnoAndes"),
    ("VIA-BOTELLA", "Botella térmica de acero inoxidable", 25, "Viaje", "VoltaPro"),
    ("VIA-CANDADO", "Candado TSA para equipaje", 12, "Viaje", "VoltaPro"),
    ("VIA-ORGANIZADOR", "Organizador de cables para viaje", 15, "Viaje", "VoltaPro"),
]

# Complementos y compatibilidades del cluster fotografía + audio + gaming.
_COMPLEMENTA = [
    ("FOT-LENTE-50", "FOT-CAM-Z50"), ("FOT-SD-128", "FOT-CAM-Z50"),
    ("FOT-MOCHILA", "FOT-CAM-Z50"), ("FOT-TRIPODE", "FOT-CAM-Z50"),
    ("FOT-BAT-Z", "FOT-CAM-Z50"), ("FOT-FLASH", "FOT-CAM-Z50"),
    ("FOT-CORREA", "FOT-CAM-Z50"), ("FOT-FILTRO", "FOT-LENTE-50"),
    ("AUD-INTERFAZ", "AUD-MICRO"), ("AUD-BRAZO", "AUD-MICRO"),
    ("AUD-CABLE-XLR", "AUD-MICRO"), ("AUD-ESPUMA", "AUD-MICRO"),
    ("GAM-CONTROL", "GAM-CONSOLA"), ("GAM-AURI", "GAM-CONSOLA"),
    ("GAM-BASE", "GAM-CONTROL"),
]

# La BAT-X200 NO está aquí: no es compatible con la Z50 (esa es la trampa).
_COMPATIBLE = [
    ("FOT-LENTE-50", "FOT-CAM-Z50"), ("FOT-SD-128", "FOT-CAM-Z50"),
    ("FOT-MOCHILA", "FOT-CAM-Z50"), ("FOT-BAT-Z", "FOT-CAM-Z50"),
    ("FOT-FLASH", "FOT-CAM-Z50"), ("FOT-CORREA", "FOT-CAM-Z50"),
    ("FOT-TRIPODE", "FOT-CAM-Z50"),
    ("GAM-CONTROL", "GAM-CONSOLA"), ("GAM-BASE", "GAM-CONSOLA"),
]

# Compras por cluster: (skus del cluster, nº de clientes)
_CLUSTER_FOTO = ["FOT-CAM-Z50", "FOT-LENTE-50", "FOT-SD-128", "FOT-MOCHILA",
                 "FOT-TRIPODE", "FOT-BAT-Z", "FOT-FLASH", "FOT-CORREA", "FOT-FILTRO"]
_CLUSTER_AUDIO = ["AUD-MICRO", "AUD-INTERFAZ", "AUD-BRAZO", "AUD-CABLE-XLR",
                  "AUD-ESPUMA", "AUD-AURI-BT", "AUD-PARLANTE"]
_CLUSTER_GAMING = ["GAM-CONSOLA", "GAM-CONTROL", "GAM-AURI", "GAM-JUEGO-1",
                   "GAM-JUEGO-2", "GAM-SILLA", "GAM-BASE"]
_RELLENO = ["COM-LAPTOP", "COM-MOUSE", "COM-TECLADO", "COM-MONITOR", "COM-HUB",
            "COM-DISCO", "VIA-MALETA", "VIA-MOCHILA-URB", "VIA-BOTELLA",
            "VIA-CANDADO", "VIA-ORGANIZADOR"]

_BUSQUEDAS_FONDO = [
    "cámara mirrorless para principiantes", "lente para retratos",
    "micrófono para podcast", "audífonos con cancelación de ruido",
    "consola de videojuegos", "silla para jugar",
    "teclado mecánico silencioso", "monitor para diseño",
    "maleta liviana de cabina", "parlante para la ducha",
    "batería para cámara nakura", "trípode liviano de viaje",
    "tarjeta de memoria rápida", "flash para bodas",
    "interfaz para grabar guitarra", "mochila con puerto usb",
    "disco duro para respaldos", "control extra para consola",
    "organizador de maleta", "filtro para lente 52mm",
]


def seed(db):
    rng = Rng(1101)

    productos = [
        {
            "sku": sku,
            "nombre": nombre,
            "precio": precio,
            "categoria": cat,
            "emb": embed(f"{nombre} {cat}"),
        }
        for sku, nombre, precio, cat, marca in _CATALOGO
    ]
    categorias = [{"nombre": c} for c in sorted({c[3] for c in _CATALOGO})]
    marcas = [{"nombre": m} for m in sorted({c[4] for c in _CATALOGO})]

    de_categoria = [{"src": sku, "dst": cat} for sku, _, _, cat, _ in _CATALOGO]
    de_marca = [{"src": sku, "dst": marca} for sku, _, _, _, marca in _CATALOGO]

    # ── Clientes por segmento de comportamiento ─────────────────────────
    clientes = [{"nombre": _CLIENTA, "ciudad": "Quito"}]
    compro, vio = [], []

    def comprar(cliente, sku, mes):
        compro.append({"src": cliente, "dst": sku, "fecha": f"2026-{mes:02d}-{rng.randint(1, 28):02d}"})

    # Andrea: tiene la cámara y un filtro; vio trípodes y mochilas.
    comprar(_CLIENTA, _CAMARA, 5)
    comprar(_CLIENTA, "FOT-FILTRO", 5)
    vio.append({"src": _CLIENTA, "dst": "FOT-TRIPODE"})
    vio.append({"src": _CLIENTA, "dst": "FOT-MOCHILA"})

    nombres_usados = {_CLIENTA}

    def nuevo_cliente():
        nombre = rng.nombre()
        while nombre in nombres_usados:
            nombre = rng.nombre()
        nombres_usados.add(nombre)
        clientes.append({"nombre": nombre, "ciudad": rng.ciudad()})
        return nombre

    compradores_x200 = []
    # 12 fotógrafos: todos con la Z50 y 3–5 complementos.
    for i in range(12):
        nombre = nuevo_cliente()
        comprar(nombre, _CAMARA, rng.randint(1, 4))
        extras = rng.sample(_CLUSTER_FOTO[1:], rng.randint(3, 5))
        for sku in extras:
            comprar(nombre, sku, rng.randint(2, 6))
        if i < 4:  # los que cayeron en la trampa de la batería genérica
            comprar(nombre, "FOT-BAT-X200", rng.randint(3, 6))
            compradores_x200.append(nombre)
        for sku in rng.sample(_CLUSTER_FOTO + _RELLENO, 2):
            vio.append({"src": nombre, "dst": sku})

    # 10 podcasters / audio.
    for _ in range(10):
        nombre = nuevo_cliente()
        for sku in rng.sample(_CLUSTER_AUDIO, rng.randint(3, 5)):
            comprar(nombre, sku, rng.randint(1, 6))
        vio.append({"src": nombre, "dst": rng.choice(_CLUSTER_AUDIO)})

    # 10 gamers.
    for _ in range(10):
        nombre = nuevo_cliente()
        comprar(nombre, "GAM-CONSOLA", rng.randint(1, 3))
        for sku in rng.sample(_CLUSTER_GAMING[1:], rng.randint(2, 4)):
            comprar(nombre, sku, rng.randint(2, 6))
        vio.append({"src": nombre, "dst": rng.choice(_CLUSTER_GAMING)})

    # 12 clientes mixtos (ruido realista).
    for _ in range(12):
        nombre = nuevo_cliente()
        for sku in rng.sample(_RELLENO, rng.randint(2, 4)):
            comprar(nombre, sku, rng.randint(1, 6))

    # ── Devoluciones: la batería genérica no sirve para la Z50 ─────────
    devoluciones, genero, de_producto = [], [], []
    for j, quien in enumerate(compradores_x200[:3]):
        codigo = f"DEV-{2026}{j:03d}"
        devoluciones.append({"codigo": codigo, "motivo": "incompatibilidad",
                             "detalle": "No encaja en la Cámara Nakura Z50"})
        genero.append({"src": quien, "dst": codigo})
        de_producto.append({"src": codigo, "dst": "FOT-BAT-X200"})
    for j in range(8):  # devoluciones de fondo con otros motivos
        codigo = f"DEV-F{j:03d}"
        devoluciones.append({"codigo": codigo, "motivo": rng.choice(["defecto", "arrepentimiento", "talla"]),
                             "detalle": "—"})
        cliente = rng.choice(clientes[1:])["nombre"]
        genero.append({"src": cliente, "dst": codigo})
        de_producto.append({"src": codigo, "dst": rng.choice(_RELLENO + _CLUSTER_GAMING)})

    # ── Búsquedas (contexto de intención) ───────────────────────────────
    busquedas = [{"codigo": f"BUS-{i:03d}", "texto": texto}
                 for i, texto in enumerate(_BUSQUEDAS_FONDO)]
    busquedas.append({"codigo": "BUS-ANDREA", "texto": "mochila para llevar cámara bajo lluvia"})
    hizo = [{"src": _CLIENTA, "dst": "BUS-ANDREA"}]
    for i in range(len(_BUSQUEDAS_FONDO)):
        cliente = rng.choice(clientes[1:])["nombre"]
        hizo.append({"src": cliente, "dst": f"BUS-{i:03d}"})

    # ── Carga ───────────────────────────────────────────────────────────
    db.cypher("CREATE CONSTRAINT producto_sku IF NOT EXISTS FOR (p:Producto) REQUIRE p.sku IS UNIQUE")
    db.cypher("CREATE CONSTRAINT cliente_nombre IF NOT EXISTS FOR (c:Cliente) REQUIRE c.nombre IS UNIQUE")

    load_nodes(db, "Producto", productos)
    load_nodes(db, "Cliente", clientes)
    load_nodes(db, "Categoria", categorias)
    load_nodes(db, "Marca", marcas)
    load_nodes(db, "Busqueda", busquedas)
    load_nodes(db, "Devolucion", devoluciones)
    load_edges(db, "Producto", "sku", "DE_CATEGORIA", "Categoria", "nombre", de_categoria)
    load_edges(db, "Producto", "sku", "DE_MARCA", "Marca", "nombre", de_marca)
    load_edges(db, "Producto", "sku", "COMPLEMENTA", "Producto", "sku",
               [{"src": a, "dst": b} for a, b in _COMPLEMENTA])
    load_edges(db, "Producto", "sku", "COMPATIBLE_CON", "Producto", "sku",
               [{"src": a, "dst": b} for a, b in _COMPATIBLE])
    load_edges(db, "Cliente", "nombre", "COMPRO", "Producto", "sku", compro, rel_props=["fecha"])
    load_edges(db, "Cliente", "nombre", "VIO", "Producto", "sku", vio)
    load_edges(db, "Cliente", "nombre", "HIZO", "Busqueda", "codigo", hizo)
    load_edges(db, "Cliente", "nombre", "GENERO", "Devolucion", "codigo", genero)
    load_edges(db, "Devolucion", "codigo", "DE_PRODUCTO", "Producto", "sku", de_producto)


# Vector de la búsqueda de Andrea, precomputado (determinista) e inline
# para que la query sea copiable tal cual. En producción vendría de tu
# proveedor de embeddings.
_VEC_BUSQUEDA = embed("mochila para llevar cámara bajo lluvia Fotografía")

QUERIES = [
    {
        "id": "siguiente-mejor-oferta",
        "titulo": "Siguiente mejor oferta por co-compra",
        "descripcion": (
            "Qué compraron los clientes que tienen lo mismo que Andrea — "
            "excluyendo lo que ya posee y lo que acumula devoluciones por "
            "incompatibilidad (la batería genérica queda fuera)."
        ),
        "cypher": """\
MATCH (a:Cliente {nombre: 'Andrea Villamar'})-[:COMPRO]->(mio:Producto)
MATCH (par:Cliente)-[:COMPRO]->(mio)
MATCH (par)-[:COMPRO]->(rec:Producto)
WHERE par.nombre <> 'Andrea Villamar'
OPTIONAL MATCH (rec)<-[ya:COMPRO]-(a)
OPTIONAL MATCH (rec)<-[:DE_PRODUCTO]-(dev_inc:Devolucion {motivo: 'incompatibilidad'})
WITH rec, par, ya, dev_inc
WHERE ya IS NULL AND dev_inc IS NULL
WITH rec, count(DISTINCT par) AS clientes_similares
MATCH (rec)-[:DE_CATEGORIA]->(cat:Categoria)
RETURN rec.nombre AS recomendacion, cat.nombre AS categoria,
       rec.precio AS precio, clientes_similares
ORDER BY clientes_similares DESC
LIMIT 6""",
    },
    {
        "id": "recomendacion-explicable",
        "titulo": "Por qué se recomienda (explicable)",
        "descripcion": (
            "Cada recomendación con su evidencia: cuántos clientes similares "
            "la compraron y si es complemento directo de algo que Andrea ya tiene."
        ),
        "cypher": """\
MATCH (a:Cliente {nombre: 'Andrea Villamar'})-[:COMPRO]->(mio:Producto)
MATCH (par:Cliente)-[:COMPRO]->(mio)
MATCH (par)-[:COMPRO]->(rec:Producto)
MATCH (rec)-[:COMPLEMENTA]->(mio)
WHERE par.nombre <> 'Andrea Villamar'
OPTIONAL MATCH (rec)<-[ya:COMPRO]-(a)
WITH rec, mio, par, ya
WHERE ya IS NULL
MATCH (rec)-[:DE_MARCA]->(marca:Marca)
RETURN rec.nombre AS recomendado,
       mio.nombre AS complementa_a,
       count(DISTINCT par) AS clientes_similares,
       marca.nombre AS marca
ORDER BY clientes_similares DESC
LIMIT 6""",
    },
    {
        "id": "evitar-devoluciones",
        "titulo": "Incompatibilidades que cuestan devoluciones",
        "descripcion": (
            "Productos co-comprados por dueños de la misma cámara que NO son "
            "compatibles con ella y ya acumulan devoluciones: lo que el "
            "recomendador debe dejar de sugerir."
        ),
        "cypher": """\
MATCH (dueno:Cliente)-[:COMPRO]->(cam:Producto {sku: 'FOT-CAM-Z50'})
MATCH (dueno)-[:COMPRO]->(cand:Producto)
WHERE cand.sku <> 'FOT-CAM-Z50'
MATCH (dev:Devolucion {motivo: 'incompatibilidad'})-[:DE_PRODUCTO]->(cand)
OPTIONAL MATCH (cand)-[compat:COMPATIBLE_CON]->(cam)
WITH cand, dueno, dev, compat
WHERE compat IS NULL
WITH cand, count(DISTINCT dueno) AS compradores, count(DISTINCT dev) AS devoluciones
RETURN cand.nombre AS producto,
       compradores AS lo_compraron_con_la_camara,
       devoluciones AS devoluciones_por_incompatibilidad,
       devoluciones * cand.precio AS costo_evitado
ORDER BY devoluciones_por_incompatibilidad DESC""",
    },
    {
        "id": "segmentos-comportamiento",
        "titulo": "Segmentos por comportamiento conectado",
        "descripcion": (
            "Comunidades reales en la red de co-compra (label propagation): "
            "fotografía, audio y gaming emergen sin definirlas a mano."
        ),
        "cypher": """\
CALL algo.label_propagation({edge_types: ['COMPRO']})
YIELD node_id, community
WITH node_id AS n, community
MATCH (c:Cliente) WHERE id(c) = id(n)
WITH community, count(DISTINCT c) AS clientes, collect(DISTINCT c.nombre) AS nombres
WHERE clientes > 2
RETURN community AS segmento, clientes, nombres
ORDER BY clientes DESC""",
    },
    {
        "id": "busqueda-semantica",
        "titulo": "Búsqueda híbrida: texto + significado",
        "descripcion": (
            "La búsqueda de Andrea — “mochila para llevar cámara bajo "
            "lluvia” — no coincide literalmente con ningún nombre; la fusión "
            "BM25 + vectores encuentra la mochila fotográfica impermeable."
        ),
        "cypher": f"""\
CALL search.hybrid({{label: 'Producto', text_property: 'nombre',
                    query_text: 'mochila para llevar cámara bajo lluvia',
                    vector_property: 'emb',
                    query_vector: {_VEC_BUSQUEDA},
                    k: 5}})
YIELD node, score
RETURN node.nombre AS producto, node.precio AS precio,
       round(score * 10000) / 10000 AS score
ORDER BY score DESC""",
    },
]
