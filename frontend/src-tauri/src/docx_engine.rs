use std::collections::HashMap;
use std::io::{Cursor, Read, Write};
use std::sync::{Mutex, OnceLock};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};
use serde::{Deserialize, Serialize};
use regex::Regex;
use chrono::{Datelike, NaiveDate};

pub const MASTER_TEMPLATE_BYTES: &[u8] = include_bytes!("../templates/TEMPLATE_LAPHAR_MASTER.docx");

static MEDIA_CACHE: OnceLock<Mutex<HashMap<String, Vec<u8>>>> = OnceLock::new();

fn get_media_cache() -> &'static Mutex<HashMap<String, Vec<u8>>> {
    MEDIA_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn store_media(id: &str, data: Vec<u8>) {
    if let Ok(mut map) = get_media_cache().lock() {
        map.insert(id.to_string(), data);
    }
}

pub fn get_media(id: &str) -> Option<Vec<u8>> {
    get_media_cache().lock().ok()?.get(id).cloned()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellDrawing {
    pub col_idx: usize,
    pub drawing_xml: String,
    pub media_id: String,
    pub original_target: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityItem {
    pub subsatgas: String,
    pub unit_name: String,
    pub satgas: String,
    pub activity_time: String,
    pub personnel_count: String,
    pub location: String,
    pub activity_desc: String,
    pub results: String,
    pub notes: String,
    #[serde(default)]
    pub drawings: Vec<CellDrawing>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentItem {
    pub incident_time: String,
    pub location: String,
    pub incident_desc: String,
    pub casualties_losses: String,
    pub actions_taken: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSummary {
    pub filename: String,
    pub subsatgas: String,
    pub items_count: usize,
    pub incidents_count: usize,
    pub detected_date: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub total_files: usize,
    pub detected_date: Option<String>,
    pub files: Vec<FileSummary>,
    pub total_items: usize,
    pub total_incidents: usize,
    pub items: Vec<ActivityItem>,
    pub incidents: Vec<IncidentItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureConfig {
    pub signature_city: Option<String>,
    pub kasatgas_name: Option<String>,
    pub kasatgas_rank_nrp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    pub date: String,
    pub items: Vec<ActivityItem>,
    pub incidents: Option<Vec<IncidentItem>>,
    pub signature_config: Option<SignatureConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInput {
    pub filename: String,
    pub data: Vec<u8>,
}

pub fn xml_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}

pub fn clean_text(text: &str) -> String {
    let t = text.replace('\u{00a0}', " ")
        .replace('–', "-")
        .replace('—', "-");
    let re = Regex::new(r"\s+").unwrap();
    re.replace_all(&t, " ").trim().to_string()
}

pub fn extract_date_from_text(text: &str) -> Option<String> {
    let upper = text.to_uppercase();
    let re_id = Regex::new(r"(?i)(\d{1,2})\s+(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\s+(\d{4})").unwrap();
    if let Some(caps) = re_id.captures(&upper) {
        let day: u32 = caps.get(1).unwrap().as_str().parse().unwrap_or(1);
        let month_str = caps.get(2).unwrap().as_str();
        let year = caps.get(3).unwrap().as_str();
        let month = match month_str {
            "JANUARI" => "01",
            "FEBRUARI" => "02",
            "MARET" => "03",
            "APRIL" => "04",
            "MEI" => "05",
            "JUNI" => "06",
            "JULI" => "07",
            "AGUSTUS" => "08",
            "SEPTEMBER" => "09",
            "OKTOBER" => "10",
            "NOVEMBER" => "11",
            "DESEMBER" => "12",
            _ => "01",
        };
        return Some(format!("{}-{}-{:02}", year, month, day));
    }

    let re_iso = Regex::new(r"(\d{4})-(\d{2})-(\d{2})").unwrap();
    if let Some(caps) = re_iso.captures(text) {
        return Some(caps.get(0).unwrap().as_str().to_string());
    }
    None
}

pub fn format_indonesian_date(date_str: &str) -> String {
    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        let days = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"];
        let months = [
            "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
            "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
        ];
        let day_idx = d.weekday().num_days_from_monday() as usize;
        let day_name = days.get(day_idx).unwrap_or(&"SENIN");
        let month_name = months.get(d.month0() as usize).unwrap_or(&"JANUARI");
        return format!("{}, {:02} {} {}", day_name, d.day(), month_name, d.year());
    }
    date_str.to_string()
}

pub fn detect_subsatgas(filename: &str, paragraphs: &[String]) -> String {
    let upper = filename.to_uppercase();
    if upper.contains("MINOPS") {
        return "MINOPS".to_string();
    }
    if upper.contains("LIDIK") {
        return "LIDIK".to_string();
    }
    if upper.contains("INVEST") {
        return "INVESTIGASI".to_string();
    }
    if upper.contains("ANALIS") {
        return "ANALIS".to_string();
    }

    for p in paragraphs.iter().take(10) {
        let u = p.to_uppercase();
        if u.contains("SUBSATGAS ANALIS") {
            return "ANALIS".to_string();
        }
        if u.contains("SUBSATGAS LIDIK") {
            return "LIDIK".to_string();
        }
        if u.contains("SUBSATGAS INVEST") {
            return "INVESTIGASI".to_string();
        }
        if u.contains("MINOPS") {
            return "MINOPS".to_string();
        }
    }

    "MINOPS".to_string()
}

pub fn normalize_unit_name(unit_raw: &str, subsatgas: &str) -> String {
    let mut clean = clean_text(unit_raw).to_uppercase();
    let re_num = Regex::new(r"^(?:[IVXLCDM]+|\d+)[.)]?\s*").unwrap();
    clean = re_num.replace(&clean, "").to_string();

    let re_prefix = Regex::new(r"^(?:UNIT|WILAYAH)\s+").unwrap();
    clean = re_prefix.replace(&clean, "").to_string();
    clean = clean.replace('–', "-").replace('—', "-").trim().to_string();

    if clean.contains("PEGUBIN") || clean.contains("PEGUNUNG BINTANG") || clean.contains("PEGUNUNGAN BINTANG") {
        clean = "PEGUNUNGAN BINTANG".to_string();
    } else if clean.contains("WAMENA") || clean.contains("KRING JAYAWIJAYA") {
        clean = "LANNY JAYA - KRING JAYAWIJAYA".to_string();
    } else if clean.contains("SINAK") {
        clean = "PUNCAK KRING SINAK".to_string();
    } else if clean.contains("ILAGA") || clean.contains("PUNCAK / ILAGA") {
        clean = "PUNCAK / ILAGA".to_string();
    }

    let prefix = if subsatgas == "ANALIS" { "WILAYAH " } else { "UNIT " };
    let formatted = format!("{}{}", prefix, clean);

    let official_units = [
        "UNIT JAYAPURA", "UNIT TIMIKA", "UNIT LANNY JAYA – KRING JAYAWIJAYA",
        "UNIT PUNCAK / ILAGA", "UNIT PUNCAK KRING SINAK", "UNIT PEGUNUNGAN BINTANG",
        "UNIT YAHUKIMO", "UNIT NDUGA", "UNIT INTAN JAYA", "UNIT DOGIYAI",
        "UNIT PANIAI", "UNIT NABIRE",
        "WILAYAH JAYAPURA", "WILAYAH TIMIKA", "WILAYAH JAYAWIJAYA",
        "WILAYAH PUNCAK", "WILAYAH PEGUNUNGAN BINTANG", "WILAYAH YAHUKIMO",
        "WILAYAH NDUGA", "WILAYAH INTAN JAYA", "WILAYAH DOGIYAI",
        "WILAYAH PANIAI", "WILAYAH NABIRE"
    ];

    for off in &official_units {
        let off_clean = off.replace('–', "-").replace('—', "-").to_uppercase();
        if formatted == off_clean || off_clean.contains(&clean) {
            return off.to_string();
        }
    }

    formatted
}

fn extract_text_from_xml(xml: &str) -> String {
    let re_t = Regex::new(r"<w:t\b[^>]*>(.*?)</w:t>").unwrap();
    let mut out = String::new();
    for cap in re_t.captures_iter(xml) {
        out.push_str(&cap[1]);
    }
    clean_text(&out)
}

pub fn parse_docx_bytes(data: &[u8], filename: &str) -> Result<(String, Option<String>, Vec<ActivityItem>, Vec<IncidentItem>), String> {
    let cursor = Cursor::new(data);
    let mut zip = ZipArchive::new(cursor).map_err(|e| format!("Invalid ZIP archive: {}", e))?;

    let mut doc_xml_content = String::new();
    {
        let mut file = zip.by_name("word/document.xml")
            .map_err(|e| format!("Could not find word/document.xml: {}", e))?;
        file.read_to_string(&mut doc_xml_content)
            .map_err(|e| format!("Failed reading word/document.xml: {}", e))?;
    }

    // Extract paragraphs for metadata
    let re_p = Regex::new(r"(?s)<w:p\b[^>]*>.*?</w:p>").unwrap();
    let mut paragraphs = Vec::new();
    for m in re_p.find_iter(&doc_xml_content).take(25) {
        paragraphs.push(extract_text_from_xml(m.as_str()));
    }

    let subsatgas = detect_subsatgas(filename, &paragraphs);

    let mut detected_date = extract_date_from_text(filename);
    if detected_date.is_none() {
        for p in paragraphs.iter().take(15) {
            if let Some(d) = extract_date_from_text(p) {
                detected_date = Some(d);
                break;
            }
        }
    }

    // Extract Image Relationships from word/_rels/document.xml.rels
    let mut rid_to_media: HashMap<String, (String, String)> = HashMap::new();
    let mut image_rels = HashMap::new();
    {
        if let Ok(mut rels_file) = zip.by_name("word/_rels/document.xml.rels") {
            let mut rels_str = String::new();
            if rels_file.read_to_string(&mut rels_str).is_ok() {
                let re_rel = Regex::new(r#"<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bType="[^"]*image"[^>]*\bTarget="([^"]+)""#).unwrap();
                for cap in re_rel.captures_iter(&rels_str) {
                    image_rels.insert(cap[1].to_string(), cap[2].to_string());
                }
                let re_rel_rev = Regex::new(r#"<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\bType="[^"]*image""#).unwrap();
                for cap in re_rel_rev.captures_iter(&rels_str) {
                    image_rels.insert(cap[1].to_string(), cap[2].to_string());
                }
            }
        }
    }

    let sanitized_fname = filename.chars().filter(|c| c.is_alphanumeric()).collect::<String>();
    for (rid, target) in image_rels {
        let target_in_zip = if target.starts_with("media/") {
            format!("word/{}", target)
        } else if target.starts_with('/') {
            target.trim_start_matches('/').to_string()
        } else if !target.starts_with("word/") {
            format!("word/{}", target)
        } else {
            target.clone()
        };

        if let Ok(mut img_file) = zip.by_name(&target_in_zip) {
            let mut img_bytes = Vec::new();
            if img_file.read_to_end(&mut img_bytes).is_ok() && !img_bytes.is_empty() {
                let media_id = format!("{}_{}", sanitized_fname, rid);
                store_media(&media_id, img_bytes);
                rid_to_media.insert(rid, (media_id, target));
            }
        }
    }

    // Extract Tables
    let re_tbl = Regex::new(r"(?s)<w:tbl\b[^>]*>.*?</w:tbl>").unwrap();
    let tables: Vec<&str> = re_tbl.find_iter(&doc_xml_content).map(|m| m.as_str()).collect();

    let mut items = Vec::new();
    let mut incidents = Vec::new();

    if tables.is_empty() {
        return Ok((subsatgas, detected_date, items, incidents));
    }

    let re_tr = Regex::new(r"(?s)<w:tr\b[^>]*>.*?</w:tr>").unwrap();
    let re_tc = Regex::new(r"(?s)<w:tc\b[^>]*>.*?</w:tc>").unwrap();
    let re_dw = Regex::new(r"(?s)<w:drawing\b[^>]*>.*?</w:drawing>").unwrap();
    let re_blip = Regex::new(r#"r:(?:embed|link)="([^"]+)""#).unwrap();

    let tbl0 = tables[0];
    let mut default_unit = None;
    if subsatgas == "MINOPS" {
        let u_fname = filename.to_uppercase();
        if u_fname.contains("JAYAPURA") {
            default_unit = Some("UNIT JAYAPURA".to_string());
        } else if u_fname.contains("TIMIKA") {
            default_unit = Some("UNIT TIMIKA".to_string());
        } else if u_fname.contains("JAYAWIJAYA") || u_fname.contains("WAMENA") || u_fname.contains("LANNY") {
            default_unit = Some("UNIT LANNY JAYA - KRING JAYAWIJAYA".to_string());
        }
    }

    let mut current_unit = default_unit;
    let mut last_context = HashMap::new();
    last_context.insert("time", String::new());
    last_context.insert("location", String::new());
    last_context.insert("personnel", String::new());

    for tr_m in re_tr.find_iter(tbl0) {
        let tr_xml = tr_m.as_str();
        let tc_matches: Vec<_> = re_tc.find_iter(tr_xml).collect();
        let cells: Vec<String> = tc_matches.iter().map(|tc_m| extract_text_from_xml(tc_m.as_str())).collect();
        if cells.is_empty() || cells.iter().all(|c| c.trim().is_empty()) {
            continue;
        }

        let non_empty: Vec<&String> = cells.iter().filter(|c| !c.trim().is_empty()).collect();
        if non_empty.len() == 1 {
            let val = non_empty[0].to_uppercase();
            let keywords = ["UNIT", "WILAYAH", "KRING", "JAYAPURA", "TIMIKA", "LANNY", "YAHUKIMO", "NDUGA", "INTAN", "NABIRE", "PUNCAK", "MIMIKA", "PEGUNUNG"];
            if keywords.iter().any(|&k| val.contains(k)) {
                current_unit = Some(normalize_unit_name(non_empty[0], &subsatgas));
                last_context.insert("time", String::new());
                last_context.insert("location", String::new());
                last_context.insert("personnel", String::new());
                continue;
            }
        }

        let row_str = cells.join(" ").to_uppercase();
        if cells[0].to_uppercase().contains("NO") && (row_str.contains("WAKTU") || row_str.contains("SATGAS") || row_str.contains("JAM") || row_str.contains("PUKUL")) {
            continue;
        }
        let compact = row_str.replace(' ', "");
        if compact == "1234567" || compact == "12345678" {
            continue;
        }
        if row_str.contains("KEPOLISIAN NEGARA") || row_str.contains("SATUAN TUGAS") || row_str.contains("KASUBSATGAS") {
            continue;
        }

        if cells.len() < 6 {
            continue;
        }

        // Extract drawings in this row
        let mut row_drawings = Vec::new();
        for (c_idx, tc_m) in tc_matches.iter().enumerate() {
            let tc_xml = tc_m.as_str();
            for dw_m in re_dw.find_iter(tc_xml) {
                let dw_xml = dw_m.as_str();
                if let Some(blip_cap) = re_blip.captures(dw_xml) {
                    let embed_rid = &blip_cap[1];
                    if let Some((media_id, orig_target)) = rid_to_media.get(embed_rid) {
                        let b64 = get_media(media_id).map(|bytes| {
                            use base64::prelude::*;
                            let mime = if orig_target.to_lowercase().ends_with(".png") {
                                "image/png"
                            } else {
                                "image/jpeg"
                            };
                            format!("data:{};base64,{}", mime, BASE64_STANDARD.encode(&bytes))
                        });

                        row_drawings.push(CellDrawing {
                            col_idx: c_idx,
                            drawing_xml: dw_xml.to_string(),
                            media_id: media_id.clone(),
                            original_target: orig_target.clone(),
                            image_base64: b64,
                        });
                    }
                }
            }
        }

        let mut item = ActivityItem {
            subsatgas: subsatgas.clone(),
            unit_name: current_unit.clone().unwrap_or_else(|| "UNIT JAYAPURA".to_string()),
            satgas: "Gakkum".to_string(),
            activity_time: String::new(),
            personnel_count: String::new(),
            location: String::new(),
            activity_desc: String::new(),
            results: String::new(),
            notes: String::new(),
            drawings: row_drawings,
        };

        if subsatgas == "MINOPS" {
            item.satgas = if cells.len() > 1 && !cells[1].trim().is_empty() { cells[1].clone() } else { "Gakkum".to_string() };
            item.activity_time = if cells.len() > 2 { cells[2].clone() } else { String::new() };
            item.personnel_count = if cells.len() > 3 { cells[3].clone() } else { String::new() };
            item.location = if cells.len() > 4 { cells[4].clone() } else { String::new() };
            item.activity_desc = if cells.len() > 5 { cells[5].clone() } else { String::new() };
            item.results = if cells.len() > 6 { cells[6].clone() } else { String::new() };
            item.notes = if cells.len() > 7 { cells[7].clone() } else { String::new() };
        } else if subsatgas == "LIDIK" || subsatgas == "INVESTIGASI" {
            item.activity_time = if cells.len() > 1 { cells[1].clone() } else { String::new() };
            item.personnel_count = if cells.len() > 2 { cells[2].clone() } else { String::new() };
            item.location = if cells.len() > 3 { cells[3].clone() } else { String::new() };
            item.activity_desc = if cells.len() > 4 { cells[4].clone() } else { String::new() };
            item.results = if cells.len() > 5 { cells[5].clone() } else { String::new() };
            item.notes = if cells.len() > 6 { cells[6].clone() } else { String::new() };
        } else if subsatgas == "ANALIS" {
            item.activity_time = if cells.len() > 1 { cells[1].clone() } else { String::new() };
            item.location = if cells.len() > 2 { cells[2].clone() } else { String::new() };
            item.activity_desc = if cells.len() > 3 { cells[3].clone() } else { String::new() };
            item.results = if cells.len() > 4 { cells[4].clone() } else { String::new() };
            item.personnel_count = if cells.len() > 5 { cells[5].clone() } else { String::new() };
            item.notes = if cells.len() > 6 { cells[6].clone() } else { String::new() };

            if !item.activity_time.is_empty() {
                last_context.insert("time", item.activity_time.clone());
            } else {
                item.activity_time = last_context["time"].clone();
            }

            if !item.location.is_empty() {
                last_context.insert("location", item.location.clone());
            } else {
                item.location = last_context["location"].clone();
            }

            if !item.personnel_count.is_empty() {
                last_context.insert("personnel", item.personnel_count.clone());
            } else {
                item.personnel_count = last_context["personnel"].clone();
            }
        }

        if !item.activity_desc.trim().is_empty() || !item.results.trim().is_empty() || !item.drawings.is_empty() {
            items.push(item);
        }
    }

    // Table 1: Kejadian Menonjol
    if tables.len() > 1 {
        let tbl1 = tables[1];
        let mut first = true;
        for tr_m in re_tr.find_iter(tbl1) {
            if first {
                first = false;
                continue;
            }
            let c: Vec<String> = re_tc.find_iter(tr_m.as_str()).map(|tc_m| extract_text_from_xml(tc_m.as_str())).collect();
            if c.len() >= 6 && (!c[3].trim().is_empty() || !c[2].trim().is_empty()) {
                let desc = c[3].trim();
                if desc != "-" && !desc.is_empty() && desc != "=" && desc != "NIHIL" {
                    incidents.push(IncidentItem {
                        incident_time: if c.len() > 1 { c[1].clone() } else { String::new() },
                        location: if c.len() > 2 { c[2].clone() } else { String::new() },
                        incident_desc: c[3].clone(),
                        casualties_losses: if c.len() > 4 { c[4].clone() } else { String::new() },
                        actions_taken: if c.len() > 5 { c[5].clone() } else { String::new() },
                        notes: if c.len() > 6 { c[6].clone() } else { String::new() },
                    });
                }
            }
        }
    }

    Ok((subsatgas, detected_date, items, incidents))
}

pub fn parse_multiple_docx(files: Vec<FileInput>) -> ParseResult {
    let mut all_items = Vec::new();
    let mut all_incidents = Vec::new();
    let mut file_summaries = Vec::new();
    let mut detected_dates = Vec::new();

    for file in files {
        if !file.filename.to_lowercase().ends_with(".docx") {
            continue;
        }

        match parse_docx_bytes(&file.data, &file.filename) {
            Ok((subsatgas, date_opt, items, incidents)) => {
                if let Some(ref d) = date_opt {
                    detected_dates.push(d.clone());
                }
                file_summaries.push(FileSummary {
                    filename: file.filename,
                    subsatgas,
                    items_count: items.len(),
                    incidents_count: incidents.len(),
                    detected_date: date_opt,
                    error: None,
                });
                all_items.extend(items);
                all_incidents.extend(incidents);
            }
            Err(e) => {
                file_summaries.push(FileSummary {
                    filename: file.filename,
                    subsatgas: "UNKNOWN".to_string(),
                    items_count: 0,
                    incidents_count: 0,
                    detected_date: None,
                    error: Some(e),
                });
            }
        }
    }

    let overall_date = if !detected_dates.is_empty() {
        let mut counts = HashMap::new();
        for d in &detected_dates {
            *counts.entry(d).or_insert(0) += 1;
        }
        counts.into_iter().max_by_key(|&(_, count)| count).map(|(d, _)| d.clone())
    } else {
        None
    };

    ParseResult {
        total_files: file_summaries.len(),
        detected_date: overall_date,
        files: file_summaries,
        total_items: all_items.len(),
        total_incidents: all_incidents.len(),
        items: all_items,
        incidents: all_incidents,
    }
}

// ---------------------------------------------------------------------------
// RAW XML PRESERVING MERGER (Zero corruption, 100% Microsoft Word compatible)
// ---------------------------------------------------------------------------

#[allow(dead_code)]
fn set_tc_content(tc_xml: &str, text: &str, bold: bool) -> String {
    set_tc_content_with_drawings(tc_xml, text, bold, &[])
}

fn set_tc_content_with_drawings(
    tc_xml: &str,
    text: &str,
    bold: bool,
    cell_drawings: &[String],
) -> String {
    let re_tcpr = Regex::new(r"(?s)<w:tcPr\b[^>]*>.*?</w:tcPr>").unwrap();
    let tc_pr = match re_tcpr.find(tc_xml) {
        Some(m) => m.as_str().to_string(),
        None => String::new(),
    };

    let re_ppr = Regex::new(r"(?s)<w:pPr\b[^>]*>.*?</w:pPr>").unwrap();
    let p_pr = match re_ppr.find(tc_xml) {
        Some(m) => m.as_str().to_string(),
        None => "<w:pPr><w:pStyle w:val=\"TableParagraph\"/></w:pPr>".to_string(),
    };

    let b_tag = if bold { "<w:b/>" } else { "" };
    let esc_text = xml_escape(text);
    let space_attr = if esc_text.starts_with(' ') || esc_text.ends_with(' ') {
        " xml:space=\"preserve\""
    } else {
        ""
    };

    let text_run = if !esc_text.is_empty() {
        format!(
            "<w:r><w:rPr><w:rFonts w:ascii=\"Arial\" w:hAnsi=\"Arial\"/>{}<w:sz w:val=\"24\"/><w:szCs w:val=\"24\"/><w:lang w:val=\"id-ID\"/></w:rPr><w:t{}>{}</w:t></w:r>",
            b_tag, space_attr, esc_text
        )
    } else {
        String::new()
    };

    let drawings_runs: String = cell_drawings
        .iter()
        .map(|d_xml| {
            format!(
                "<w:r><w:rPr><w:noProof/><w:lang w:val=\"id-ID\"/></w:rPr>{}</w:r>",
                d_xml
            )
        })
        .collect::<Vec<_>>()
        .join("");

    format!("<w:tc>{}<w:p>{}{}{}</w:p></w:tc>", tc_pr, p_pr, text_run, drawings_runs)
}

fn set_row_values(tr_xml: &str, values: &[&str]) -> String {
    set_row_values_with_drawings(tr_xml, values, &HashMap::new())
}

fn set_row_values_with_drawings(
    tr_xml: &str,
    values: &[&str],
    drawings_by_col: &HashMap<usize, Vec<String>>,
) -> String {
    let re_tc = Regex::new(r"(?s)<w:tc\b[^>]*>.*?</w:tc>").unwrap();
    let tc_matches: Vec<_> = re_tc.find_iter(tr_xml).collect();
    if tc_matches.is_empty() {
        return tr_xml.to_string();
    }

    let mut out = String::with_capacity(tr_xml.len());
    out.push_str(&tr_xml[..tc_matches[0].start()]);

    for (i, m) in tc_matches.iter().enumerate() {
        let val = if i < values.len() { values[i] } else { "" };
        let col_drawings = drawings_by_col.get(&i).map(|v| v.as_slice()).unwrap_or(&[]);
        out.push_str(&set_tc_content_with_drawings(m.as_str(), val, false, col_drawings));
    }

    out.push_str(&tr_xml[tc_matches.last().unwrap().end()..]);

    ensure_cant_split_in_tr(&out)
}

fn prepare_drawings_for_item(
    drawings: &[CellDrawing],
    subsatgas: &str,
    entries: &mut HashMap<String, Vec<u8>>,
    new_relationships: &mut Vec<String>,
    next_rid_num: &mut usize,
) -> HashMap<usize, Vec<String>> {
    let mut drawings_by_col: HashMap<usize, Vec<String>> = HashMap::new();
    let re_embed = Regex::new(r#"r:(?:embed|link)="[^"]*""#).unwrap();
    let re_docpr = Regex::new(r#"<wp:docPr\b[^>]*\bid="[^"]*""#).unwrap();

    for dw in drawings {
        if let Some(img_bytes) = get_media(&dw.media_id) {
            let ext = if dw.original_target.to_lowercase().ends_with(".png") {
                "png"
            } else if dw.original_target.to_lowercase().ends_with(".gif") {
                "gif"
            } else {
                "jpeg"
            };

            let media_name = format!("merged_img_{}.{}", *next_rid_num, ext);
            let new_rid = format!("rIdImg{}", *next_rid_num);
            let new_docpr_id = *next_rid_num + 50000;

            entries.insert(format!("word/media/{}", media_name), img_bytes);
            new_relationships.push(format!(
                r#"<Relationship Id="{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{}"/>"#,
                new_rid, media_name
            ));

            let mut updated_dw = re_embed.replace_all(&dw.drawing_xml, format!(r#"r:embed="{}""#, new_rid)).to_string();
            updated_dw = re_docpr.replace(&updated_dw, format!(r#"<wp:docPr id="{}""#, new_docpr_id)).to_string();

            *next_rid_num += 1;

            let target_col = if dw.col_idx == 6 && subsatgas == "MINOPS" {
                6
            } else if dw.col_idx == 5 && (subsatgas == "LIDIK" || subsatgas == "INVESTIGASI") {
                6
            } else {
                7
            };

            drawings_by_col.entry(target_col).or_default().push(updated_dw);
        }
    }

    drawings_by_col
}

fn ensure_cant_split_in_tr(tr_xml: &str) -> String {
    if tr_xml.contains("<w:cantSplit") {
        return tr_xml.to_string();
    }
    // In ECMA-376 schema, cantSplit MUST come BEFORE trHeight inside trPr
    if tr_xml.contains("<w:trHeight") {
        return tr_xml.replacen("<w:trHeight", "<w:cantSplit/><w:trHeight", 1);
    }
    if tr_xml.contains("</w:trPr>") {
        return tr_xml.replacen("</w:trPr>", "<w:cantSplit/></w:trPr>", 1);
    }
    // If no trPr, insert at start of tr
    let re_tr_open = Regex::new(r"^<w:tr\b[^>]*>").unwrap();
    if let Some(m) = re_tr_open.find(tr_xml) {
        let mut res = String::new();
        res.push_str(&tr_xml[..m.end()]);
        res.push_str("<w:trPr><w:cantSplit/></w:trPr>");
        res.push_str(&tr_xml[m.end()..]);
        return res;
    }
    tr_xml.to_string()
}

pub fn merge_items_to_master(payload: MergeRequest) -> Result<Vec<u8>, String> {
    let template_cursor = Cursor::new(MASTER_TEMPLATE_BYTES);
    let mut zip_in = ZipArchive::new(template_cursor)
        .map_err(|e| format!("Failed to open master template archive: {}", e))?;

    let mut entries = HashMap::new();
    for i in 0..zip_in.len() {
        let mut file = zip_in.by_index(i)
            .map_err(|e| format!("Failed reading file from template archive: {}", e))?;
        let name = file.name().to_string();
        let mut data = Vec::new();
        file.read_to_end(&mut data)
            .map_err(|e| format!("Failed to read content for {}: {}", name, e))?;
        entries.insert(name, data);
    }

    let doc_xml_bytes = entries.get("word/document.xml")
        .ok_or_else(|| "Template is missing word/document.xml".to_string())?;

    let mut doc_xml = String::from_utf8(doc_xml_bytes.clone())
        .map_err(|e| format!("Template document.xml is not valid UTF-8: {}", e))?;

    let formatted_date_upper = format_indonesian_date(&payload.date).to_uppercase();
    let sig_config = payload.signature_config.unwrap_or(SignatureConfig {
        signature_city: Some("Jayapura".to_string()),
        kasatgas_name: Some("I G.G. ERA ADHINATA, S.I.K.".to_string()),
        kasatgas_rank_nrp: Some("KOMISARIS BESAR POLISI NRP 80020993".to_string()),
    });
    let city = sig_config.signature_city.unwrap_or_else(|| "Jayapura".to_string());
    let kasatgas_name = sig_config.kasatgas_name.unwrap_or_else(|| "I G.G. ERA ADHINATA, S.I.K.".to_string());
    let kasatgas_rank = sig_config.kasatgas_rank_nrp.unwrap_or_else(|| "KOMISARIS BESAR POLISI NRP 80020993".to_string());

    let date_parts: Vec<&str> = formatted_date_upper.split(',').collect();
    let date_only = if date_parts.len() > 1 { date_parts[1].trim() } else { &formatted_date_upper };

    // 1. Update Title and Header Paragraphs
    let re_title_hari = Regex::new(r"(?s)(<w:t[^>]*>HARI\s*/\s*TANGGAL\s*:\s*).*?(</w:t>)").unwrap();
    doc_xml = re_title_hari.replace_all(&doc_xml, format!("${{1}}{}${{2}}", formatted_date_upper)).to_string();

    let re_title_tgl = Regex::new(r"(?s)(<w:t[^>]*>LAPORAN HARIAN.*?)TANGGAL\s+\d{1,2}\s+\w+\s+\d{4}(.*?</w:t>)").unwrap();
    doc_xml = re_title_tgl.replace_all(&doc_xml, format!("${{1}}TANGGAL {}${{2}}", date_only)).to_string();

    // 2. Update Signature Block
    let sig_date_line = format!("{}, {}", city, to_title_case(date_only));
    let re_sig_date = Regex::new(r"(?s)(<w:t[^>]*>Jayapura,\s*).*?(</w:t>)").unwrap();
    doc_xml = re_sig_date.replace_all(&doc_xml, format!("<w:t>{}</w:t>", sig_date_line)).to_string();

    let re_sig_name = Regex::new(r"(?s)<w:t[^>]*>I G\.G\. ERA ADHINATA, S\.I\.K\.</w:t>").unwrap();
    doc_xml = re_sig_name.replace_all(&doc_xml, format!("<w:t>{}</w:t>", xml_escape(&kasatgas_name))).to_string();

    let re_sig_rank = Regex::new(r"(?s)<w:t[^>]*>KOMISARIS BESAR POLISI NRP 80020993</w:t>").unwrap();
    doc_xml = re_sig_rank.replace_all(&doc_xml, format!("<w:t>{}</w:t>", xml_escape(&kasatgas_rank))).to_string();

    // 3. Group Activity Items by (Subsatgas, Normalized Unit)
    let mut items_by_unit: HashMap<(String, String), Vec<ActivityItem>> = HashMap::new();
    for it in payload.items {
        let sub = it.subsatgas.to_uppercase();
        let unit = it.unit_name.to_uppercase().replace('–', "-").replace('—', "-");
        items_by_unit.entry((sub, unit)).or_default().push(it);
    }

    // Prepare relationships and IDs for images
    let mut max_rid_num = 100;
    let re_rid = Regex::new(r#"rId(\d+)"#).unwrap();
    if let Some(rels_bytes) = entries.get("word/_rels/document.xml.rels") {
        if let Ok(rels_str) = std::str::from_utf8(rels_bytes) {
            for cap in re_rid.captures_iter(rels_str) {
                if let Ok(n) = cap[1].parse::<usize>() {
                    if n > max_rid_num {
                        max_rid_num = n;
                    }
                }
            }
        }
    }
    let mut next_rid_num = max_rid_num + 1;
    let mut new_relationships = Vec::new();

    // 4. Process Table 0
    let t0_start = doc_xml.find("<w:tbl").ok_or_else(|| "Table 0 not found".to_string())?;
    let t0_end = doc_xml[t0_start..].find("</w:tbl>").ok_or_else(|| "Table 0 end not found".to_string())? + t0_start + "</w:tbl>".len();
    let t0_xml = &doc_xml[t0_start..t0_end];

    let re_tr = Regex::new(r"(?s)<w:tr\b[^>]*>.*?</w:tr>").unwrap();
    let mut t0_rows: Vec<String> = re_tr.find_iter(t0_xml).map(|m| m.as_str().to_string()).collect();

    // Map Table 0 Sections
    struct Section {
        subsatgas: String,
        unit_name: String,
        _heading_idx: usize,
        placeholder_indices: Vec<usize>,
    }

    let mut sections: Vec<Section> = Vec::new();
    let mut current_sub = "MINOPS".to_string();

    for (r_idx, row_xml) in t0_rows.iter().enumerate() {
        let texts = extract_text_from_xml(row_xml).to_uppercase();
        if texts == "MINOPS" || texts == "SUBSATGAS LIDIK" || texts == "SUBSATGAS INVESTIGASI" || texts == "SUBSATGAS ANALIS" {
            current_sub = texts.replace("SUBSATGAS ", "");
            continue;
        } else if texts.contains("UNIT") || texts.contains("WILAYAH") {
            sections.push(Section {
                subsatgas: current_sub.clone(),
                unit_name: texts.replace('–', "-").replace('—', "-"),
                _heading_idx: r_idx,
                placeholder_indices: Vec::new(),
            });
            continue;
        }

        if let Some(sec) = sections.last_mut() {
            sec.placeholder_indices.push(r_idx);
        }
    }

    // Process sections in REVERSE order so insertions don't invalidate prior indices
    for sec in sections.iter().rev() {
        let sub = &sec.subsatgas;
        let sec_unit = &sec.unit_name;
        let placeholders = &sec.placeholder_indices;
        if placeholders.is_empty() {
            continue;
        }

        let mut matched_items: Vec<&ActivityItem> = Vec::new();
        for ((k_sub, k_unit), u_items) in &items_by_unit {
            if k_sub == sub && (k_unit == sec_unit || k_unit.contains(sec_unit) || sec_unit.contains(k_unit)) {
                matched_items = u_items.iter().collect();
                break;
            }
        }

        let template_row_str = t0_rows[placeholders[0]].clone();

        if matched_items.is_empty() {
            // First placeholder: set Nihil dashes
            let row = &mut t0_rows[placeholders[0]];
            *row = set_row_values(row, &["", "Gakkum", "-", "-", "-", "-", "-", "-"]);

            // Clear remaining placeholders
            for &ph_idx in placeholders.iter().skip(1) {
                let r = &mut t0_rows[ph_idx];
                *r = set_row_values(r, &["", "", "", "", "", "", "", ""]);
            }
            continue;
        }

        let mut item_idx = 0;
        let mut last_idx = placeholders[0];

        for &ph_idx in placeholders {
            if item_idx < matched_items.len() {
                let it = matched_items[item_idx];
                let num_str = format!("{}.", item_idx + 1);
                let item_drawings = prepare_drawings_for_item(
                    &it.drawings,
                    &it.subsatgas,
                    &mut entries,
                    &mut new_relationships,
                    &mut next_rid_num,
                );
                let row = &mut t0_rows[ph_idx];
                *row = set_row_values_with_drawings(
                    row,
                    &[
                        &num_str,
                        &it.satgas,
                        &it.activity_time,
                        &it.personnel_count,
                        &it.location,
                        &it.activity_desc,
                        &it.results,
                        &it.notes,
                    ],
                    &item_drawings,
                );
                last_idx = ph_idx;
                item_idx += 1;
            } else {
                let r = &mut t0_rows[ph_idx];
                *r = set_row_values(r, &["", "", "", "", "", "", "", ""]);
            }
        }

        // Additional items exceed placeholder slots: duplicate template row
        while item_idx < matched_items.len() {
            let it = matched_items[item_idx];
            let num_str = format!("{}.", item_idx + 1);
            let item_drawings = prepare_drawings_for_item(
                &it.drawings,
                &it.subsatgas,
                &mut entries,
                &mut new_relationships,
                &mut next_rid_num,
            );
            let new_row = set_row_values_with_drawings(
                &template_row_str,
                &[
                    &num_str,
                    &it.satgas,
                    &it.activity_time,
                    &it.personnel_count,
                    &it.location,
                    &it.activity_desc,
                    &it.results,
                    &it.notes,
                ],
                &item_drawings,
            );
            t0_rows.insert(last_idx + 1, new_row);
            last_idx += 1;
            item_idx += 1;
        }
    }

    // Reconstruct Table 0
    let tbl0_prefix = if let Some(tr_pos) = t0_xml.find("<w:tr") {
        &t0_xml[..tr_pos]
    } else {
        "<w:tbl>"
    };

    let reconstructed_t0 = format!("{}{}</w:tbl>", tbl0_prefix, t0_rows.join(""));
    doc_xml = format!("{}{}{}", &doc_xml[..t0_start], reconstructed_t0, &doc_xml[t0_end..]);

    // 5. Process Table 1 (Kejadian Menonjol)
    if let Some(t1_rel_start) = doc_xml[t0_start + reconstructed_t0.len()..].find("<w:tbl") {
        let t1_start = t0_start + reconstructed_t0.len() + t1_rel_start;
        if let Some(t1_rel_end) = doc_xml[t1_start..].find("</w:tbl>") {
            let t1_end = t1_start + t1_rel_end + "</w:tbl>".len();
            let t1_xml = &doc_xml[t1_start..t1_end];

            let mut t1_rows: Vec<String> = re_tr.find_iter(t1_xml).map(|m| m.as_str().to_string()).collect();
            if t1_rows.len() >= 2 {
                let template_t1_row = t1_rows[1].clone();
                let incidents = payload.incidents.as_deref().unwrap_or(&[]);

                if incidents.is_empty() {
                    let r1 = &mut t1_rows[1];
                    *r1 = set_row_values(r1, &["1", "NIHIL", "NIHIL", "NIHIL", "NIHIL", "NIHIL", "NIHIL"]);
                } else {
                    for (idx, inc) in incidents.iter().enumerate() {
                        let num_str = format!("{}", idx + 1);
                        if idx + 1 < t1_rows.len() {
                            let r = &mut t1_rows[idx + 1];
                            *r = set_row_values(
                                r,
                                &[
                                    &num_str,
                                    &inc.incident_time,
                                    &inc.location,
                                    &inc.incident_desc,
                                    &inc.casualties_losses,
                                    &inc.actions_taken,
                                    &inc.notes,
                                ],
                            );
                        } else {
                            let new_r = set_row_values(
                                &template_t1_row,
                                &[
                                    &num_str,
                                    &inc.incident_time,
                                    &inc.location,
                                    &inc.incident_desc,
                                    &inc.casualties_losses,
                                    &inc.actions_taken,
                                    &inc.notes,
                                ],
                            );
                            t1_rows.push(new_r);
                        }
                    }
                }
                let tbl1_prefix = if let Some(tr_pos) = t1_xml.find("<w:tr") {
                    &t1_xml[..tr_pos]
                } else {
                    "<w:tbl>"
                };

                let reconstructed_t1 = format!("{}{}</w:tbl>", tbl1_prefix, t1_rows.join(""));
                doc_xml = format!("{}{}{}", &doc_xml[..t1_start], reconstructed_t1, &doc_xml[t1_end..]);
            }
        }
    }

    entries.insert("word/document.xml".to_string(), doc_xml.into_bytes());

    // Update document.xml.rels with newly added images
    if !new_relationships.is_empty() {
        if let Some(rels_bytes) = entries.get_mut("word/_rels/document.xml.rels") {
            if let Ok(rels_str) = String::from_utf8(rels_bytes.clone()) {
                let updated = rels_str.replacen(
                    "</Relationships>",
                    &format!("{}</Relationships>", new_relationships.join("")),
                    1,
                );
                *rels_bytes = updated.into_bytes();
            }
        }
    }

    // Ensure content types has jpg, jpeg, png defaults
    if let Some(ct_bytes) = entries.get_mut("[Content_Types].xml") {
        if let Ok(mut ct_str) = String::from_utf8(ct_bytes.clone()) {
            if !ct_str.contains("Extension=\"jpg\"") {
                ct_str = ct_str.replacen(
                    "</Types>",
                    "<Default Extension=\"jpg\" ContentType=\"image/jpeg\"/></Types>",
                    1,
                );
            }
            if !ct_str.contains("Extension=\"jpeg\"") {
                ct_str = ct_str.replacen(
                    "</Types>",
                    "<Default Extension=\"jpeg\" ContentType=\"image/jpeg\"/></Types>",
                    1,
                );
            }
            if !ct_str.contains("Extension=\"png\"") {
                ct_str = ct_str.replacen(
                    "</Types>",
                    "<Default Extension=\"png\" ContentType=\"image/png\"/></Types>",
                    1,
                );
            }
            *ct_bytes = ct_str.into_bytes();
        }
    }

    // 6. Build new zip binary
    let mut out_buf = Cursor::new(Vec::new());
    {
        let mut zip_out = ZipWriter::new(&mut out_buf);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for (name, data) in entries {
            zip_out.start_file(name, options)
                .map_err(|e| format!("Failed to write zip entry: {}", e))?;
            zip_out.write_all(&data)
                .map_err(|e| format!("Failed to write data for zip entry: {}", e))?;
        }
        zip_out.finish().map_err(|e| format!("Failed finalizing zip: {}", e))?;
    }

    Ok(out_buf.into_inner())
}

fn to_title_case(s: &str) -> String {
    let mut result = String::new();
    for word in s.split_whitespace() {
        if !result.is_empty() {
            result.push(' ');
        }
        let mut chars = word.chars();
        if let Some(first) = chars.next() {
            result.extend(first.to_uppercase());
            result.extend(chars.as_str().to_lowercase().chars());
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_items_to_master() {
        let req = MergeRequest {
            date: "2026-10-12".to_string(),
            items: vec![
                ActivityItem {
                    subsatgas: "MINOPS".to_string(),
                    unit_name: "UNIT JAYAPURA".to_string(),
                    satgas: "Gakkum".to_string(),
                    activity_time: "08.00 WIT".to_string(),
                    personnel_count: "10 Pers".to_string(),
                    location: "Posko Minops Jayapura".to_string(),
                    activity_desc: "Melaksanakan apel pagi dan pengecekan kesiapan personel Satgas Gakkum.".to_string(),
                    results: "Seluruh personel lengkap dan siap operasional.".to_string(),
                    notes: "Situasi aman terkendali.".to_string(),
                    drawings: vec![],
                },
                ActivityItem {
                    subsatgas: "LIDIK".to_string(),
                    unit_name: "UNIT JAYAPURA".to_string(),
                    satgas: "Gakkum".to_string(),
                    activity_time: "09.30 WIT".to_string(),
                    personnel_count: "6 Pers".to_string(),
                    location: "Sentani, Jayapura".to_string(),
                    activity_desc: "Monitoring pergerakan target DPO kelompok KKB di wilayah Sentani.".to_string(),
                    results: "Terpantau aktivitas komunikasi target.".to_string(),
                    notes: "Bahan analisa lebih lanjut.".to_string(),
                    drawings: vec![],
                },
            ],
            incidents: Some(vec![
                IncidentItem {
                    incident_time: "14.15 WIT".to_string(),
                    location: "Puncak Jaya".to_string(),
                    incident_desc: "Terjadinya gangguan tembakan terhadap pos pengamanan.".to_string(),
                    casualties_losses: "Korban jiwa nihil, kerugian materil nihil.".to_string(),
                    actions_taken: "Pengejaran dan pengetatan patroli gabungan.".to_string(),
                    notes: "Siaga 1.".to_string(),
                }
            ]),
            signature_config: Some(SignatureConfig {
                signature_city: Some("Jayapura".to_string()),
                kasatgas_name: Some("I G.G. ERA ADHINATA, S.I.K.".to_string()),
                kasatgas_rank_nrp: Some("KOMISARIS BESAR POLISI NRP 80020993".to_string()),
            }),
        };

        let result = merge_items_to_master(req);
        assert!(result.is_ok(), "Failed to merge: {:?}", result.err());
        let bytes = result.unwrap();
        assert!(!bytes.is_empty(), "Merged docx bytes should not be empty");

        std::fs::write("test_merged.docx", &bytes).unwrap();

        let cursor = Cursor::new(bytes);
        let mut zip = ZipArchive::new(cursor).expect("Resulting docx is not valid zip");
        assert!(zip.by_name("word/document.xml").is_ok(), "Resulting docx lacks document.xml");
    }

    #[test]
    fn test_parse_and_merge_real_example_files() {
        let example_dir = std::path::Path::new("test/example");
        if !example_dir.exists() {
            println!("test/example directory not found, skipping real file test");
            return;
        }

        let mut files = Vec::new();
        for entry in std::fs::read_dir(example_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("docx") {
                let filename = path.file_name().unwrap().to_str().unwrap().to_string();
                let data = std::fs::read(&path).unwrap();
                files.push(FileInput { filename, data });
            }
        }

        assert!(!files.is_empty(), "Should find example docx files");
        let parse_result = parse_multiple_docx(files);
        println!("Parsed {} files, detected date: {:?}", parse_result.total_files, parse_result.detected_date);
        println!("Total activity items: {}, total incidents: {}", parse_result.total_items, parse_result.total_incidents);

        assert!(parse_result.total_items > 0, "Should have extracted activity items");
        let date = parse_result.detected_date.clone().unwrap_or_else(|| "2026-10-05".to_string());
        let total_drawings: usize = parse_result.items.iter().map(|it| it.drawings.len()).sum();
        let total_b64: usize = parse_result.items.iter().flat_map(|it| &it.drawings).filter(|d| d.image_base64.is_some()).count();
        println!("Total image drawings extracted across all items: {}, with base64 data URLs: {}", total_drawings, total_b64);
        assert!(total_drawings > 0, "Should have extracted image drawings from activity rows");
        assert_eq!(total_drawings, total_b64, "All drawings should have base64 data URLs");

        let req = MergeRequest {
            date,
            items: parse_result.items,
            incidents: Some(parse_result.incidents),
            signature_config: Some(SignatureConfig {
                signature_city: Some("Jayapura".to_string()),
                kasatgas_name: Some("I G.G. ERA ADHINATA, S.I.K.".to_string()),
                kasatgas_rank_nrp: Some("KOMISARIS BESAR POLISI NRP 80020993".to_string()),
            }),
        };

        let merge_res = merge_items_to_master(req);
        assert!(merge_res.is_ok(), "Merge failed: {:?}", merge_res.err());
        let merged_bytes = merge_res.unwrap();
        assert!(!merged_bytes.is_empty());

        let out_path = "test/test_real_merged_output.docx";
        std::fs::write(out_path, &merged_bytes).unwrap();
        println!("Successfully wrote merged output to {}", out_path);

        // Verify document.xml inside merged docx
        let cursor = Cursor::new(merged_bytes);
        let mut zip = ZipArchive::new(cursor).expect("Valid zip archive");
        let mut doc_xml_str = String::new();
        {
            let mut doc_xml_file = zip.by_name("word/document.xml").expect("Contains word/document.xml");
            doc_xml_file.read_to_string(&mut doc_xml_str).expect("Valid UTF-8 XML");
        }

        // Validate that there is no namespace stripping: any val= in a <w:...> tag must have w:val=
        let re_naked_val = Regex::new(r#"<w:[^>]*?\sval\s*=\s*""#).unwrap();
        assert!(!re_naked_val.is_match(&doc_xml_str), "Found naked val= attribute in w: tag! Namespace was stripped!");

        // Validate that in CT_TrPr, cantSplit is before trHeight
        let re_bad_trpr = Regex::new(r#"<w:trHeight[^>]*/>\s*<w:cantSplit"#).unwrap();
        assert!(!re_bad_trpr.is_match(&doc_xml_str), "Found cantSplit after trHeight! Violates ECMA-376 schema order!");

        let mut media_count = 0;
        for i in 0..zip.len() {
            let f = zip.by_index(i).unwrap();
            if f.name().starts_with("word/media/merged_img_") {
                media_count += 1;
            }
        }
        println!("Total merged media files inside output docx: {}", media_count);
        assert!(media_count > 0, "Output docx should contain merged media files");
    }
}
