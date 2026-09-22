"""Generación del informe de auditoría en PDF (reportlab).

build_session_pdf(session_dict, out_path) produce un informe profesional con
portada, resumen ejecutivo y hallazgos por severidad (con fotos de evidencia
embebidas).
"""
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
    HRFlowable, PageBreak, KeepTogether,
)

SEV_ORDER = ["critical", "high", "medium", "low", "info"]
SEV_LABEL = {"critical": "CRÍTICO", "high": "ALTO", "medium": "MEDIO",
             "low": "BAJO", "info": "INFO"}
SEV_HEX = {"critical": "#c62828", "high": "#ef6c00", "medium": "#f9a825",
           "low": "#2e7d32", "info": "#1565c0"}
SEV_COLOR = {k: colors.HexColor(v) for k, v in SEV_HEX.items()}
INK = colors.HexColor("#1a2430")
MUTED = colors.HexColor("#5b6b7a")
ACCENT = colors.HexColor("#0a7ea4")
LIGHT = colors.HexColor("#eef2f6")


def _fmt(dt):
    if not dt:
        return "—"
    try:
        return datetime.fromisoformat(str(dt).replace("Z", "")).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(dt)


def _styles():
    ss = getSampleStyleSheet()
    st = {}
    st["title"] = ParagraphStyle("t", parent=ss["Title"], fontSize=26, leading=30,
                                 textColor=INK, spaceAfter=6)
    st["subtitle"] = ParagraphStyle("st", parent=ss["Normal"], fontSize=13, leading=17,
                                    textColor=MUTED, alignment=TA_CENTER)
    st["h1"] = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=15, leading=19,
                              textColor=ACCENT, spaceBefore=10, spaceAfter=6)
    st["h2"] = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, leading=15,
                              textColor=INK, spaceBefore=6, spaceAfter=3)
    st["body"] = ParagraphStyle("b", parent=ss["Normal"], fontSize=9.5, leading=14,
                                textColor=INK)
    st["muted"] = ParagraphStyle("m", parent=ss["Normal"], fontSize=8.5, leading=12,
                                 textColor=MUTED)
    st["mono"] = ParagraphStyle("mo", parent=ss["Normal"], fontName="Courier",
                                fontSize=8, leading=11, textColor=colors.HexColor("#33414f"))
    st["label"] = ParagraphStyle("l", parent=ss["Normal"], fontSize=7.5, leading=10,
                                 textColor=MUTED, spaceAfter=1)
    st["ftitle"] = ParagraphStyle("ft", parent=ss["Heading2"], fontSize=11.5, leading=15,
                                  textColor=INK, spaceAfter=2)
    st["cell"] = ParagraphStyle("c", parent=ss["Normal"], fontSize=9, leading=12,
                                textColor=INK)
    return st


def _esc(t):
    return (str(t) if t is not None else "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(LIGHT)
    canvas.setLineWidth(0.6)
    canvas.line(2 * cm, 1.4 * cm, w - 2 * cm, 1.4 * cm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(2 * cm, 1.05 * cm, "WFAudit · Informe confidencial de auditoría WiFi")
    canvas.drawRightString(w - 2 * cm, 1.05 * cm, f"Página {doc.page}")
    canvas.restoreState()


def _sev_meter(counts, st):
    """Barra apilada de severidades."""
    total = sum(counts.get(s, 0) for s in SEV_ORDER) or 1
    row, widths, styles = [], [], []
    idx = 0
    for s in SEV_ORDER:
        n = counts.get(s, 0)
        if n <= 0:
            continue
        row.append(Paragraph(f'<font color="white"><b>{n}</b></font>', st["cell"]))
        widths.append(max(1.1 * cm, (n / total) * 15.5 * cm))
        styles.append(("BACKGROUND", (idx, 0), (idx, 0), SEV_COLOR[s]))
        idx += 1
    if not row:
        return Spacer(1, 1)
    t = Table([row], colWidths=widths, rowHeights=[0.7 * cm])
    ts = [("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("BOX", (0, 0), (-1, -1), 0, colors.white)]
    ts.extend(styles)
    t.setStyle(TableStyle(ts))
    return t


def _image_flowable(path, max_w=15 * cm, max_h=9 * cm):
    try:
        from PIL import Image as PILImage
        with PILImage.open(path) as im:
            iw, ih = im.size
        ratio = min(max_w / iw, max_h / ih, 1.0)
        w, h = iw * ratio, ih * ratio
        if w < 3 * cm:  # imágenes muy pequeñas: escalar a un mínimo legible
            k = (3 * cm) / w
            w, h = w * k, min(h * k, max_h)
        return Image(path, width=w, height=h)
    except Exception:
        try:
            return Image(path, width=8 * cm, height=6 * cm)
        except Exception:
            return None


def build_session_pdf(s: dict, out_path: str):
    st = _styles()
    doc = SimpleDocTemplate(out_path, pagesize=A4,
                            leftMargin=2 * cm, rightMargin=2 * cm,
                            topMargin=1.8 * cm, bottomMargin=1.8 * cm,
                            title=f"Informe de auditoría — {s.get('name','')}")
    story = []
    findings = sorted(s.get("findings", []),
                      key=lambda f: (SEV_ORDER.index(f.get("severity", "info"))
                                     if f.get("severity") in SEV_ORDER else 5))
    counts = {sev: sum(1 for f in findings if f.get("severity") == sev) for sev in SEV_ORDER}
    total = len(findings)

    # ── Portada ──
    story.append(Spacer(1, 3.2 * cm))
    story.append(Paragraph("Informe de Auditoría de Seguridad WiFi", st["title"]))
    story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, spaceBefore=4, spaceAfter=14,
                            hAlign="CENTER"))
    story.append(Paragraph(_esc(s.get("name", "")), st["subtitle"]))
    story.append(Spacer(1, 0.5 * cm))
    meta = [
        ["Cliente / Empresa", _esc(s.get("company") or "—")],
        ["Auditor", _esc(s.get("auditor") or "—")],
        ["Estado", "Cerrada" if s.get("status") == "closed" else "Abierta"],
        ["Creada", _fmt(s.get("created_at"))],
        ["Cerrada", _fmt(s.get("closed_at")) if s.get("closed_at") else "—"],
        ["ID de sesión", _esc(s.get("id", ""))],
    ]
    mt = Table([[Paragraph(f'<b>{k}</b>', st["muted"]), Paragraph(v, st["cell"])] for k, v in meta],
               colWidths=[5 * cm, 10.5 * cm])
    mt.setStyle(TableStyle([
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LIGHT), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(mt)
    if s.get("scope"):
        story.append(Spacer(1, 0.5 * cm))
        story.append(Paragraph("<b>Alcance</b>", st["muted"]))
        story.append(Paragraph(_esc(s.get("scope")), st["body"]))
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph(f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", st["muted"]))
    story.append(PageBreak())

    # ── Resumen ejecutivo ──
    story.append(Paragraph("Resumen ejecutivo", st["h1"]))
    story.append(Paragraph(
        f"Durante la auditoría se han identificado <b>{total}</b> hallazgo(s). "
        "La distribución por severidad se resume a continuación.", st["body"]))
    story.append(Spacer(1, 0.3 * cm))

    head = [Paragraph(f'<font color="white"><b>{SEV_LABEL[s2]}</b></font>', st["cell"]) for s2 in SEV_ORDER]
    vals = [Paragraph(f'<b>{counts[s2]}</b>', st["cell"]) for s2 in SEV_ORDER]
    ct = Table([head, vals], colWidths=[3.1 * cm] * 5)
    cts = [("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
           ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
           ("ROWBACKGROUNDS", (0, 1), (-1, 1), [colors.white]),
           ("BOX", (0, 0), (-1, -1), 0.5, LIGHT), ("INNERGRID", (0, 0), (-1, -1), 0.5, LIGHT),
           ("FONTSIZE", (0, 1), (-1, 1), 15)]
    for i, s2 in enumerate(SEV_ORDER):
        cts.append(("BACKGROUND", (i, 0), (i, 0), SEV_COLOR[s2]))
        cts.append(("TEXTCOLOR", (i, 1), (i, 1), SEV_COLOR[s2]))
    ct.setStyle(TableStyle(cts))
    story.append(ct)
    story.append(Spacer(1, 0.4 * cm))
    story.append(_sev_meter(counts, st))
    story.append(Spacer(1, 0.5 * cm))

    # valoración de riesgo simple
    if counts["critical"]:
        risk, rc = "CRÍTICO", SEV_COLOR["critical"]
    elif counts["high"]:
        risk, rc = "ALTO", SEV_COLOR["high"]
    elif counts["medium"]:
        risk, rc = "MEDIO", SEV_COLOR["medium"]
    elif total:
        risk, rc = "BAJO", SEV_COLOR["low"]
    else:
        risk, rc = "SIN HALLAZGOS", MUTED
    rt = Table([[Paragraph('<font color="white"><b>NIVEL DE RIESGO GLOBAL</b></font>', st["cell"]),
                 Paragraph(f'<font color="white"><b>{risk}</b></font>', st["cell"])]],
               colWidths=[8 * cm, 7.5 * cm])
    rt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), rc), ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                            ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                            ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    story.append(rt)

    # índice de hallazgos
    if findings:
        story.append(Spacer(1, 0.6 * cm))
        story.append(Paragraph("Índice de hallazgos", st["h2"]))
        idx_rows = [[Paragraph('<b>#</b>', st["muted"]), Paragraph('<b>Severidad</b>', st["muted"]),
                     Paragraph('<b>Título</b>', st["muted"])]]
        for i, f in enumerate(findings, 1):
            sev = f.get("severity", "info")
            idx_rows.append([
                Paragraph(str(i), st["cell"]),
                Paragraph(f'<font color="{SEV_HEX.get(sev, "#5b6b7a")}"><b>{SEV_LABEL.get(sev, sev)}</b></font>', st["cell"]),
                Paragraph(_esc(f.get("title", "")), st["cell"]),
            ])
        it = Table(idx_rows, colWidths=[1 * cm, 2.6 * cm, 11.9 * cm])
        it.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, LIGHT),
                                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        story.append(it)

    # ── Detalle de hallazgos ──
    if findings:
        story.append(PageBreak())
        story.append(Paragraph("Detalle de hallazgos", st["h1"]))
        for i, f in enumerate(findings, 1):
            story.extend(_finding_block(i, f, st))

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)


def _finding_block(i, f, st):
    sev = f.get("severity", "info")
    col = SEV_COLOR.get(sev, MUTED)
    parts = []
    # cabecera con banda de severidad
    hdr = Table([[Paragraph(f'<font color="white"><b>{i}. {SEV_LABEL.get(sev, sev)}</b></font>', st["cell"]),
                  Paragraph(f'<font color="white">{_esc((f.get("category") or "").upper())}'
                            + (f'  ·  CVSS {_esc(f.get("cvss"))}' if f.get("cvss") else '') + '</font>', st["cell"])]],
                colWidths=[4 * cm, 11.5 * cm])
    hdr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), col), ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                             ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                             ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9)]))
    parts.append(hdr)
    parts.append(Spacer(1, 3))
    parts.append(Paragraph(_esc(f.get("title", "")), st["ftitle"]))

    def section(label, text, mono=False):
        if not text:
            return
        parts.append(Spacer(1, 4))
        parts.append(Paragraph(label.upper(), st["label"]))
        if mono:
            # Una fila por línea: la tabla puede partirse entre páginas (una celda
            # única no puede, y desbordaba con evidencias largas p.ej. del recon).
            rows = [[Paragraph(_esc(ln) or "&nbsp;", st["mono"])] for ln in str(text).split("\n")]
            box = Table(rows, colWidths=[15.5 * cm])
            box.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4f6f8")),
                                     ("BOX", (0, 0), (-1, -1), 0.4, LIGHT),
                                     ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                                     ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
                                     ("TOPPADDING", (0, 0), (-1, 0), 5), ("BOTTOMPADDING", (0, -1), (-1, -1), 5)]))
            parts.append(box)
        else:
            parts.append(Paragraph(_esc(text).replace("\n", "<br/>"), st["body"]))

    section("Descripción", f.get("description"))
    section("Evidencia", f.get("evidence"), mono=True)
    section("Recomendación", f.get("recommendation"))

    # fotos de evidencia
    photos = f.get("photos", []) or []
    for p in photos:
        path = p.get("path")
        if path and os.path.isfile(path):
            img = _image_flowable(path)
            if img:
                parts.append(Spacer(1, 5))
                parts.append(img)
                if p.get("caption"):
                    parts.append(Paragraph(_esc(p.get("caption")), st["muted"]))

    parts.append(Spacer(1, 6))
    parts.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT, spaceBefore=2, spaceAfter=10))
    # Sin fotos: mantener el hallazgo junto en una página; con fotos, dejar fluir.
    return [KeepTogether(parts)] if not photos else parts
