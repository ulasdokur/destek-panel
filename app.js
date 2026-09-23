// Tahta Destek Paneli. Veri Supabase'de (d_ tabloları), yazma sadece RPC'lerle.
// Panel admin.tahtaapp.com'a bağlanmaz: kararlar kaydedilir, Mac'teki şikayet turu (20 dk'da bir) uygular.
const SB_URL = "https://rbjrnevngfuribasrnph.supabase.co";
const SB_ANON = "sb_publishable_yK1dNA6CGKIQ88U3gp53xA_nBLQGNVJ";
const sb = window.supabase.createClient(SB_URL, SB_ANON);

const $ = (s, el = document) => el.querySelector(s);
const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KARAR = { ONAYLA: "Onayla", REDDET: "Reddet", HAVUZA_AKTAR: "Onayla + doğru derse aktar" };
const KARAR_ACIK = { ONAYLA: "Onaylandı", REDDET: "Reddedildi", HAVUZA_AKTAR: "Derse aktarıldı" };
const KADEME = { F: "Format hatırlatması", Y: "Yapay zekâ uyarısı", G: "Genel uyarı", PASIF: "Hesabı pasife alma", AKTIF: "Hesap yeniden açıldı" };
const KAT = { yapay_zeka: "yapay zekâ", dijital_metin: "dijital metin", soru_ustune: "soru üstüne yazma", yanlis_cevap: "yanlış cevap", okunaklilik: "okunaklılık", eksik_aciklama: "eksik açıklama", diger: "diğer" };
let ben = null, sekme = "ozet";

function bildir(m) { const b = $("#bildirim"); b.textContent = m; b.hidden = false; clearTimeout(bildir.t); bildir.t = setTimeout(() => b.hidden = true, 3200); }
function tarih(t) { if (!t) return ""; const d = new Date(t); return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function haftaNo(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const g = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - g); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, "0")}`; }
async function q(p) { const { data, error } = await p; if (error) { bildir("Hata: " + error.message); throw error; } return data; }

// ---------- giriş ----------
async function basla() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return girisGoster();
  const y = await sb.from("d_yetkili").select("ad,rol").eq("email", session.user.email.toLowerCase()).maybeSingle();
  if (!y.data) { await sb.auth.signOut(); return girisGoster("Bu hesabın panele yetkisi yok."); }
  ben = { ...y.data, email: session.user.email };
  $("#giris").hidden = true; $("#uygulama").hidden = false; $("#k-ad").textContent = ben.ad;
  const h = location.hash.slice(1); if (h) sekme = h.split("/")[0];
  git(sekme, location.hash.slice(1).split("/")[1]);
  rozetler(); setInterval(rozetler, 60000);
}
function girisGoster(m = "") { $("#uygulama").hidden = true; $("#giris").hidden = false; $("#g-hata").textContent = m; }
$("#giris-form").onsubmit = async ev => {
  ev.preventDefault(); $("#g-hata").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email: $("#g-eposta").value.trim(), password: $("#g-sifre").value });
  if (error) return $("#g-hata").textContent = "E-posta ya da şifre hatalı.";
  basla();
};
$("#cikis").onclick = async () => { await sb.auth.signOut(); location.hash = ""; girisGoster(); };
$("#sifre-btn").onclick = () => { $("#s-hata").textContent = ""; $("#yeni-sifre").value = ""; $("#sifre-dlg").showModal(); };
$("#sifre-kaydet").onclick = async ev => {
  ev.preventDefault(); const s = $("#yeni-sifre").value;
  if (s.length < 10) return $("#s-hata").textContent = "En az 10 karakter.";
  const { error } = await sb.auth.updateUser({ password: s });
  if (error) return $("#s-hata").textContent = error.message;
  $("#sifre-dlg").close(); bildir("Şifre değişti.");
};

// ---------- gezinme ----------
$("#sekmeler").onclick = ev => { const b = ev.target.closest("button"); if (b) git(b.dataset.s); };
function git(s, alt) {
  sekme = s; location.hash = alt ? `${s}/${alt}` : s;
  document.querySelectorAll("#sekmeler button").forEach(b => b.classList.toggle("secili", b.dataset.s === s));
  const f = { ozet, gunluk, bekleyen, kontrol, uyari, ogretmen, sikayet }[s] || ozet;
  $("#icerik").innerHTML = '<p class="aciklama">Yükleniyor…</p>'; f(alt);
}
async function rozetler() {
  const [b, k, u] = await Promise.all([
    sb.from("d_sikayet").select("key", { count: "exact", head: true }).eq("durum", "bekliyor"),
    sb.from("d_sikayet").select("key,d_karar(id)", { count: "exact" }).eq("kontrol_hafta", haftaNo()),
    sb.from("d_uyari").select("id", { count: "exact", head: true }).eq("durum", "taslak"),
  ]);
  $("#r-bekleyen").textContent = b.count || "";
  $("#r-kontrol").textContent = (k.data || []).filter(x => !x.d_karar.length).length || "";
  $("#r-uyari").textContent = u.count || "";
}
document.addEventListener("click", ev => {
  const i = ev.target.closest(".gorseller img"); if (i) { $("#buyut img").src = i.src; $("#buyut").hidden = false; }
});
$("#buyut").onclick = () => $("#buyut").hidden = true;

// ---------- şikayet kartı ----------
function sikayetKart(s, mod) {
  const tur = s.tur === "s" ? "Soru şikayeti" : "Cevap şikayeti";
  const bilgi = [];
  if (s.tur === "s") { bilgi.push(["Şikayet eden öğretmenin seçtiği sebep", s.sebep], ["Öğrencinin soru açıklaması", s.ogrenci_notu]); }
  else {
    bilgi.push(["Öğrencinin seçimi", [s.sebep, (s.alt_sebep || []).join(", ")].filter(Boolean).join(" · ")], ["Öğrencinin notu", s.ogrenci_notu],
      ["Yorumlar", (s.yorumlar || []).join(" / ")], ["Soru açıklaması", s.soru_aciklamasi], ["Öğretmenin açıklaması", s.cevap_aciklamasi]);
    if (s.ses_dokumu) bilgi.push(["Ses dökümü", s.ses_dokumu.slice(0, 700)]);
  }
  const img = u => `<img src="${e(u)}" loading="lazy" alt="">`;
  const soru = (s.soru_url || []).map(img).join("") || '<p class="soluk">Görsel yok</p>';
  let cevap = (s.cevap_url || []).map(img).join("");
  if (s.video_url) cevap += `<video controls preload="none" src="${e(s.video_url)}"></video>`;
  const hedef = s.hedef_ders ? ` → ${e(s.hedef_ders)}` : "";
  let ajan = `<div class="ajan"><b>Ajanın kararı: ${KARAR[s.ajan_karar] || e(s.ajan_karar)}${s.ajan_karar === "HAVUZA_AKTAR" ? hedef : ""}${s.emin_degil ? ' <span class="etiket uyari">emin değil</span>' : ""}</b>${e(s.gerekce)}`;
  if (s.dogru_cevap) ajan += `<br><span class="soluk">Doğru cevap: ${e(s.dogru_cevap)} · Öğretmenin cevabı: ${e(s.ogretmen_cevabi)}</span>`;
  if (s.oneri) ajan += `<br><b style="margin-top:6px">Tur ajanının önerisi: ${KARAR[s.oneri] || e(s.oneri)}</b>${e(s.oneri_gerekce)}`;
  ajan += "</div>";
  const son = s.durum === "islendi" ? `<span class="etiket ${s.son_karar === "REDDET" ? "" : "ok"}">${KARAR_ACIK[s.son_karar] || e(s.son_karar)}</span>` : '<span class="etiket uyari">Karar bekliyor</span>';
  let alt = "";
  const k = (s.d_karar || []).find(x => x.tip === (mod === "kontrol" ? "kontrol" : "bekleyen"));
  if (mod === "bekleyen") {
    const sec = ["ONAYLA", "REDDET"].concat(s.tur === "s" && s.hedef_lecture_id ? ["HAVUZA_AKTAR"] : []);
    alt = `<div class="secimler">${sec.map(x => `<button class="secim ${k?.secim === x ? "secili" : ""}" data-v="${x}">${KARAR[x]}${x === "HAVUZA_AKTAR" ? hedef : ""}</button>`).join("")}</div>
      <textarea placeholder="Not (isteğe bağlı): neden bu karar?">${e(k?.notu)}</textarea>
      <div class="kart-alt"><span class="durum-not">${k ? (k.uygulandi ? "Panele işlendi." : `Kaydedildi (${e(k.kim)}), 20 dk içinde panele işlenecek.`) : ""}</span><button class="birincil kucuk kaydet">Kaydet</button></div>`;
  } else if (mod === "kontrol") {
    alt = `<div class="secimler"><button class="secim ${k?.secim === "DOGRU" ? "secili" : ""}" data-v="DOGRU">Karar doğru</button><button class="secim ${k?.secim === "YANLIS" ? "secili" : ""}" data-v="YANLIS">Karar yanlış</button></div>
      <textarea placeholder="Yanlışsa neden? Bu not kurallara eklenir, ajanlar bir sonraki turda okur.">${e(k?.notu)}</textarea>
      <div class="kart-alt"><span class="durum-not">${k ? `Kaydedildi (${e(k.kim)})` : ""}</span><button class="birincil kucuk kaydet">Kaydet</button></div>`;
  }
  return `<section class="kart" data-key="${e(s.key)}" data-mod="${mod}">
    <div class="kart-ust"><b>${tur}</b><span class="soluk">${e(s.ders)} · şikayet ${s.sikayet_id} · ${tarih(s.olusturma)}</span>
      ${s.ogretmen ? `<a href="#ogretmen/${s.ogretmen_id || ""}" class="soluk" onclick="event.preventDefault();${s.ogretmen_id ? `git('ogretmen','${s.ogretmen_id}')` : ""}">öğretmen: ${e(s.ogretmen)}</a>` : ""} ${son}</div>
    ${bilgi.filter(x => x[1]).map(([a, b]) => `<div class="bilgi"><span>${a}:</span> ${e(b)}</div>`).join("")}
    <div class="gorseller"><div><h4>Soru</h4>${soru}</div>${s.tur === "c" ? `<div><h4>Cevap</h4>${cevap || '<p class="soluk">Görsel yok</p>'}</div>` : ""}</div>
    ${ajan}${alt}</section>`;
}
function kartlariBagla(kok, sonra) {
  kok.querySelectorAll("section.kart").forEach(kart => {
    let secim = kart.querySelector(".secim.secili")?.dataset.v;
    kart.querySelectorAll(".secim").forEach(b => b.onclick = () => { secim = b.dataset.v; kart.querySelectorAll(".secim").forEach(x => x.classList.toggle("secili", x === b)); });
    const k = kart.querySelector(".kaydet"); if (!k) return;
    k.onclick = async () => {
      if (!secim) return bildir("Önce bir seçim yap.");
      const not = kart.querySelector("textarea").value.trim(), mod = kart.dataset.mod;
      if (mod === "kontrol" && secim === "YANLIS" && not.length < 3) return bildir("Yanlış dediysen kısaca nedenini yaz.");
      k.disabled = true;
      const { error } = await sb.rpc("d_karar_ver", { p_key: kart.dataset.key, p_tip: mod === "kontrol" ? "kontrol" : "bekleyen", p_secim: secim, p_not: not });
      k.disabled = false;
      if (error) return bildir(error.message === "zaten_islendi" ? "Bu kayıt zaten işlenmiş." : "Kaydedilemedi: " + error.message);
      kart.querySelector(".durum-not").textContent = mod === "kontrol" ? `Kaydedildi (${ben.email})` : "Kaydedildi, 20 dk içinde panele işlenecek.";
      bildir("Kaydedildi."); rozetler(); sonra && sonra();
    };
  });
}

// ---------- sekmeler ----------
async function ozet() {
  const gun = new Date(); gun.setHours(0, 0, 0, 0);
  const [dur, turlar, bugun, bek, taslak, pasifN] = await Promise.all([
    q(sb.from("d_durum").select("*")),
    q(sb.from("d_tur").select("*").order("zaman", { ascending: false }).limit(15)),
    q(sb.from("d_sikayet").select("tur,son_karar,durum").gte("olusturma", gun.toISOString())),
    sb.from("d_sikayet").select("key", { count: "exact", head: true }).eq("durum", "bekliyor"),
    sb.from("d_uyari").select("id", { count: "exact", head: true }).eq("durum", "taslak"),
    sb.from("d_ogretmen").select("id", { count: "exact", head: true }).eq("durum", "pasif"),
  ]);
  const D = Object.fromEntries(dur.map(x => [x.k, x]));
  const son = D.son_gonderim ? new Date(D.son_gonderim.zaman) : null;
  const dk = son ? Math.round((Date.now() - son) / 60000) : null;
  const oturum = D.oturum?.v?.durum;
  const say = (f) => bugun.filter(f).length;
  const kutu = (s, e_, cls = "") => `<div class="kutu ${cls}"><div class="s">${s}</div><div class="e">${e_}</div></div>`;
  $("#icerik").innerHTML = `<h2>Özet</h2><p class="aciklama">Şikayet turu Mac'te her 20 dakikada bir çalışır. Buradaki kararları da o tur uygular.</p>
    <div class="kutular">
      ${kutu(dk === null ? "—" : dk < 60 ? dk + " dk" : Math.round(dk / 60) + " sa", "son eşitlemeden bu yana", dk !== null && dk > 50 ? "uyari" : "")}
      ${kutu(oturum === "dustu" ? "Düştü" : "Açık", "admin oturumu " + (D.oturum ? "· " + e(D.oturum.v.zaman) : ""), oturum === "dustu" ? "hata" : "")}
      ${kutu(bugun.length, "bugün gelen şikayet")}
      ${kutu(say(x => x.son_karar === "ONAYLA" || x.son_karar === "HAVUZA_AKTAR") + " / " + say(x => x.son_karar === "REDDET"), "bugün onay / ret")}
      ${kutu(bek.count ?? 0, "kararını bekleyen", bek.count ? "uyari" : "")}
      ${kutu(taslak.count ?? 0, "onay bekleyen uyarı", taslak.count ? "uyari" : "")}
      ${kutu(pasifN.count ?? 0, "pasif öğretmen")}
    </div>
    <h2>Son turlar</h2>
    ${turlar.length ? turlar.map(t => `<div class="kart"><div class="kart-ust"><b>${tarih(t.zaman)}</b>
      <span class="soluk">${t.soru_n} soru · ${t.cevap_n} cevap şikayeti · ${t.onay} onay · ${t.ret} ret${t.havuz ? " · " + t.havuz + " derse aktarma" : ""}${t.bekleyen ? " · " + t.bekleyen + " sana kaldı" : ""}</span></div>
      ${t.ozet ? `<details><summary>Tur özeti</summary><pre class="ozet">${e(t.ozet)}</pre></details>` : ""}</div>`).join("") : '<div class="bos">Henüz tur yok.</div>'}`;
}

async function tumSikayetler(gun) {
  const s = new Date(Date.now() - gun * 864e5).toISOString(); let L = [], i = 0;
  while (true) {
    const d = await q(sb.from("d_sikayet").select("key,tur,son_karar,durum,olusturma,ogretmen,ogretmen_id,gerekce,question_id").gte("olusturma", s).order("olusturma").range(i, i + 999));
    L = L.concat(d); if (d.length < 1000) break; i += 1000;
  }
  return L;
}
async function gunluk() {
  const L = await tumSikayetler(30);
  const G = {};
  for (const s of L) {
    const g = s.olusturma.slice(0, 10), o = G[g] ||= { s: 0, c: 0, onay: 0, ret: 0, havuz: 0, bek: 0 };
    o[s.tur]++; if (s.durum === "bekliyor") o.bek++; else if (s.son_karar === "ONAYLA") o.onay++; else if (s.son_karar === "REDDET") o.ret++; else if (s.son_karar === "HAVUZA_AKTAR") o.havuz++;
  }
  const gunler = Object.keys(G).sort().reverse(), mx = Math.max(1, ...gunler.map(g => G[g].s + G[g].c));
  const top = k => gunler.reduce((a, g) => a + G[g][k], 0);
  $("#icerik").innerHTML = `<h2>Günlük</h2><p class="aciklama">Son 30 gün, şikayetin karara bağlandığı güne göre. Onay = şikayet eden haklı bulundu. Derse aktarma = soru onaylanıp doğru dersin havuzuna taşındı.</p>
    <div class="kutular">
      <div class="kutu"><div class="s">${top("s") + top("c")}</div><div class="e">toplam şikayet (${top("s")} soru, ${top("c")} cevap)</div></div>
      <div class="kutu"><div class="s">${top("onay")}</div><div class="e">onaylandı</div></div>
      <div class="kutu"><div class="s">${top("ret")}</div><div class="e">reddedildi</div></div>
      <div class="kutu"><div class="s">${top("havuz")}</div><div class="e">onaylanıp derse aktarıldı</div></div>
    </div>
    <div class="tablo-sar"><table class="tablo"><tr><th>Gün</th><th>Gelen</th><th>Soru / cevap</th><th>Onay</th><th>Ret</th><th>Derse aktarma</th><th>Bekleyen</th><th style="width:30%"></th></tr>
    ${gunler.map(g => { const o = G[g], n = o.s + o.c; return `<tr><td>${new Date(g + "T12:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" })}</td><td><b>${n}</b></td><td>${o.s} / ${o.c}</td><td>${o.onay}</td><td>${o.ret}</td><td>${o.havuz}</td><td>${o.bek || ""}</td>
      <td><div class="cubuk" style="width:${Math.round(n / mx * 100)}%"><span style="width:${n ? Math.round((o.onay + o.havuz) / n * 100) : 0}%"></span></div></td></tr>`; }).join("")}</table></div>
    <p class="soluk" style="margin-top:8px">Çubuk: günün şikayet hacmi, koyu kısım onaylanan + derse aktarılan.</p>`;
}

async function bekleyen() {
  const L = await q(sb.from("d_sikayet").select("*,d_karar(*)").eq("durum", "bekliyor").order("olusturma"));
  $("#icerik").innerHTML = `<h2>Kararını bekleyenler</h2><p class="aciklama">Ajanın emin olamadığı kayıtlar. Seçtiğin karar bir sonraki turda (20 dk içinde) panele işlenir. İşlenene kadar fikrini değiştirebilirsin.</p>
    ${L.length ? L.map(s => sikayetKart(s, "bekleyen")).join("") : '<div class="bos">Bekleyen kayıt yok.</div>'}`;
  kartlariBagla($("#icerik"));
}

async function kontrol() {
  const h = haftaNo();
  const L = await q(sb.from("d_sikayet").select("*,d_karar(*)").eq("kontrol_hafta", h).order("olusturma"));
  const bitti = L.filter(s => s.d_karar.some(k => k.tip === "kontrol")).length;
  $("#icerik").innerHTML = `<h2>Haftalık kontrol</h2><p class="aciklama">Bu hafta (${h}) panele işlenmiş kararlardan rastgele ${L.length} tanesi. ${bitti}/${L.length} tamamlandı.
    "Karar yanlış" dersen notun kurallara eklenir. Paneldeki kararı geri alma özelliği gelene kadar yanlış kararı admin panelinde elle düzeltmen gerekir.</p>
    ${L.length ? L.map(s => sikayetKart(s, "kontrol")).join("") : '<div class="bos">Bu haftanın örnekleri henüz seçilmedi.</div>'}`;
  kartlariBagla($("#icerik"));
}

async function uyari() {
  const [acik, gecmis] = await Promise.all([
    q(sb.from("d_uyari").select("*").in("durum", ["taslak", "onaylandi"]).order("id")),
    q(sb.from("d_uyari").select("*").in("durum", ["gonderildi", "iptal", "hata"]).order("id", { ascending: false }).limit(100)),
  ]);
  const kanitlar = [...new Set(acik.flatMap(u => u.kanit || []))];
  const K = kanitlar.length ? Object.fromEntries((await q(sb.from("d_sikayet").select("*").in("key", kanitlar))).map(s => [s.key, s])) : {};
  const kart = u => `<section class="kart" data-id="${u.id}">
    <div class="kart-ust"><b>${e(u.ad)}</b><span class="etiket ${u.kademe === "PASIF" ? "hata" : u.kademe === "G" ? "uyari" : ""}">${KADEME[u.kademe]}</span>
      <a class="soluk" href="#" onclick="event.preventDefault();git('ogretmen','${u.ogretmen_id}')">öğretmen sayfası</a>
      ${u.durum === "onaylandi" ? `<span class="etiket ok">Onaylandı (${e(u.karar_veren)}), bir sonraki turda gidecek</span>` : ""}</div>
    ${u.kademe === "PASIF" ? '<p class="bilgi"><span>Onaylarsan:</span> bildirim gider ve öğretmenin hesabı pasife alınır.</p>' : ""}
    <label>Başlık<input class="u-baslik" value="${e(u.title)}" ${u.durum !== "taslak" ? "disabled" : ""}></label>
    <label>Metin<textarea class="u-metin" rows="4" ${u.durum !== "taslak" ? "disabled" : ""}>${e(u.description)}</textarea></label>
    ${(u.kanit || []).length ? `<details><summary>Kanıt: ${u.kanit.length} şikayet</summary>${u.kanit.map(k => K[k] ? sikayetKart(K[k], "goster") : "").join("")}</details>` : ""}
    <div class="kart-alt">
      ${u.durum === "taslak" ? `<button class="ince u-iptal">Gönderme</button><button class="birincil kucuk u-onay">${u.kademe === "PASIF" ? "Onayla ve pasife al" : "Onayla ve gönder"}</button>`
      : `<button class="ince u-geri">Onayı geri al</button>`}
    </div></section>`;
  $("#icerik").innerHTML = `<h2>Uyarılar</h2><p class="aciklama">Kurallara göre hazırlanan bildirimler. Onayladıkların bir sonraki turda (20 dk içinde) gönderilir. Metni göndermeden önce düzenleyebilirsin.</p>
    ${acik.length ? acik.map(kart).join("") : '<div class="bos">Onay bekleyen uyarı yok.</div>'}
    <h2 style="margin-top:28px">Gönderilenler</h2>
    <div class="tablo-sar"><table class="tablo"><tr><th>Tarih</th><th>Öğretmen</th><th>Tür</th><th>Durum</th><th>Metin</th></tr>
    ${gecmis.map(u => `<tr><td>${tarih(u.gonderim || u.karar_zamani || u.olusturma)}</td><td><a href="#" onclick="event.preventDefault();git('ogretmen','${u.ogretmen_id}')">${e(u.ad)}</a></td><td>${KADEME[u.kademe]}</td>
      <td><span class="etiket ${u.durum === "gonderildi" ? "ok" : u.durum === "hata" ? "hata" : ""}">${{ gonderildi: "Gönderildi", iptal: "Gönderilmedi", hata: "Hata" }[u.durum]}</span>${u.sonuc ? `<br><span class="soluk">${e(u.sonuc)}</span>` : ""}</td>
      <td><details><summary>${e(u.title)}</summary><p style="margin:6px 0 0">${e(u.description)}</p></details></td></tr>`).join("")}</table></div>`;
  document.querySelectorAll("section.kart[data-id]").forEach(k => {
    const id = +k.dataset.id;
    const karar = async onay => {
      if (onay && k.querySelector(".u-baslik")) {
        const { error } = await sb.rpc("d_uyari_metin", { p_id: id, p_title: k.querySelector(".u-baslik").value, p_description: k.querySelector(".u-metin").value });
        if (error) return bildir("Metin kaydedilemedi: " + error.message);
      }
      const { error } = await sb.rpc("d_uyari_karar", { p_id: id, p_onay: onay });
      if (error) return bildir("Olmadı: " + error.message);
      bildir(onay ? "Onaylandı, bir sonraki turda gidecek." : "Gönderilmeyecek."); rozetler(); uyari();
    };
    k.querySelector(".u-onay")?.addEventListener("click", () => { if (k.querySelector(".etiket.hata") && !confirm("Bildirim gidecek ve öğretmenin hesabı pasife alınacak. Emin misin?")) return; karar(true); });
    k.querySelector(".u-iptal")?.addEventListener("click", () => karar(false));
    k.querySelector(".u-geri")?.addEventListener("click", async () => {
      const { error } = await sb.rpc("d_uyari_karar", { p_id: id, p_onay: false });
      if (error) return bildir("Geri alınamadı (gönderilmiş olabilir)."); bildir("Onay geri alındı."); uyari();
    });
  });
}

function kategori(g) {  // ~/tahta-sikayet/profil.py kategori() ile aynı
  g = (g || "").toLocaleLowerCase("tr"); const k = [];
  if (/yapay|ai çıktı|chatgpt|markdown|latex/.test(g)) k.push("yapay_zeka");
  if (/dijital|daktilo|düz metin|not uygulama/.test(g)) k.push("dijital_metin");
  if (/üst(ü|ün)ne|üzerine|görseli üz/.test(g)) k.push("soru_ustune");
  if (/yanlış|hatalı/.test(g) && /doğru(su|\s+cevap)|demiş|bulmuş/.test(g)) k.push("yanlis_cevap");
  if (/okun|bulanık|loş|yan çek|yamuk|karanlık/.test(g)) k.push("okunaklilik");
  if (/açıklan|gerekçe|eksik|yetersiz|adım/.test(g)) k.push("eksik_aciklama");
  return k.length ? k : ["diger"];
}
async function ogretmen(id) {
  if (id) return ogretmenDetay(+id);
  const [O, U, S7] = await Promise.all([
    q(sb.from("d_ogretmen").select("*").limit(2000)),
    q(sb.from("d_uyari").select("ogretmen_id,kademe,durum,gonderim,olusturma,title").order("id")),
    tumSikayetler(7),
  ]);
  const son = {}, bekleyenU = {};
  for (const u of U) {
    if (u.durum === "gonderildi" || (u.kademe === "AKTIF")) son[u.ogretmen_id] = u;
    if (u.durum === "taslak" || u.durum === "onaylandi") bekleyenU[u.ogretmen_id] = u;
  }
  const H = {};
  for (const s of S7) {
    if (s.tur !== "c" || !s.ogretmen_id || s.durum !== "islendi") continue;
    const h = H[s.ogretmen_id] ||= { onay: 0, top: 0, kat: {} }; h.top++;
    if (s.son_karar === "ONAYLA") { h.onay++; for (const k of kategori(s.gerekce)) h.kat[k] = (h.kat[k] || 0) + 1; }
  }
  const takip = o => {  // UYARI_KURALLAR.md eşikleri (son 7 gün)
    const h = H[o.id]; if (!h || o.durum === "pasif") return null;
    if (h.onay >= 4 && h.onay / h.top >= .5) return "G";
    if (h.kat.yapay_zeka) return "Y";
    if ((h.kat.dijital_metin || 0) >= 2 || (h.kat.soru_ustune || 0) >= 2) return "F";
    return null;
  };
  const takipDurum = o => {
    const k = takip(o), u = son[o.id], b = bekleyenU[o.id], yeni = u && (Date.now() - new Date(u.gonderim || u.olusturma)) < 7 * 864e5;
    if (b) return `<span class="etiket uyari">${KADEME[b.kademe]} onay bekliyor</span>`;
    if (k && !yeni) return `<span class="etiket hata">Takip gerekli (${KADEME[k]})</span>`;
    if (u) return `<span class="etiket ok">${KADEME[u.kademe]}</span><br><span class="soluk">${tarih(u.gonderim || u.olusturma)}</span>`;
    return '<span class="soluk">—</span>';
  };
  const pasif = O.filter(o => o.durum === "pasif");
  $("#icerik").innerHTML = `<h2>Öğretmenler</h2><p class="aciklama">Cevap şikayeti almış öğretmenler. Onay = öğrenci haklı bulundu. "Takip gerekli": son 7 günde uyarı eşiğini aşmış ama bildirim gitmemiş.</p>
    ${pasif.length ? `<div class="kart"><div class="kart-ust"><b>Pasife alınanlar (${pasif.length})</b></div>${pasif.map(o => `<div class="bilgi"><a href="#" onclick="event.preventDefault();git('ogretmen','${o.id}')">${e(o.ad)}</a> <span class="soluk">· ${son[o.id] ? tarih(son[o.id].gonderim) + " · " + e(son[o.id].title) : ""} · ${o.onay} onay / ${o.ret} ret</span></div>`).join("")}</div>` : ""}
    <div class="filtre"><input id="o-ara" placeholder="İsimle ara"><select id="o-durum"><option value="">Hepsi</option><option value="takip">Takip gerekenler</option><option value="bildirim">Bildirim gitmiş olanlar</option><option value="aktif">Aktif</option><option value="pasif">Pasif</option></select>
    <select id="o-sira"><option value="h">Son 7 gün onaya göre</option><option value="t">Toplam onaya göre</option></select></div>
    <div class="tablo-sar"><table class="tablo" id="o-tablo"></table></div>`;
  const ciz = () => {
    const a = $("#o-ara").value.toLocaleLowerCase("tr"), d = $("#o-durum").value;
    let S = O.filter(o => (!a || o.ad.toLocaleLowerCase("tr").includes(a)) &&
      (!d || (d === "takip" ? takip(o) && !(son[o.id] && Date.now() - new Date(son[o.id].gonderim || son[o.id].olusturma) < 7 * 864e5) : d === "bildirim" ? son[o.id] : o.durum === d)));
    S.sort($("#o-sira").value === "h" ? (x, y) => (H[y.id]?.onay || 0) - (H[x.id]?.onay || 0) || y.onay - x.onay : (x, y) => y.onay - x.onay);
    $("#o-tablo").innerHTML = `<tr><th>Öğretmen</th><th>Son 7 gün onay</th><th>Toplam onay / ret</th><th>Onay sebepleri (toplam)</th><th>Takip / bildirim</th></tr>` +
      S.map(o => `<tr class="tik" data-id="${o.id}"><td>${e(o.ad)}${o.durum === "pasif" ? ' <span class="etiket hata">Pasif</span>' : ""}</td>
        <td>${H[o.id] ? `<b>${H[o.id].onay}</b> / ${H[o.id].top}` : '<span class="soluk">—</span>'}</td><td>${o.onay} / ${o.ret}</td>
        <td class="soluk">${Object.entries(o.kategoriler || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${KAT[k] || k} ${v}`).join(", ")}</td><td>${takipDurum(o)}</td></tr>`).join("");
    $("#o-tablo").querySelectorAll("tr.tik").forEach(r => r.onclick = () => git("ogretmen", r.dataset.id));
  };
  $("#o-ara").oninput = ciz; $("#o-durum").onchange = ciz; $("#o-sira").onchange = ciz; ciz();
}
async function ogretmenDetay(id) {
  const [o, S, U] = await Promise.all([
    q(sb.from("d_ogretmen").select("*").eq("id", id).maybeSingle()),
    q(sb.from("d_sikayet").select("*").eq("ogretmen_id", id).order("olusturma", { ascending: false }).limit(60)),
    q(sb.from("d_uyari").select("*").eq("ogretmen_id", id).order("id", { ascending: false })),
  ]);
  $("#icerik").innerHTML = `<button class="geri" onclick="git('ogretmen')">← Öğretmenler</button>
    <h2>${e(o?.ad || "Öğretmen " + id)} ${o ? `<span class="etiket ${o.durum === "pasif" ? "hata" : "ok"}">${o.durum === "pasif" ? "Pasif" : "Aktif"}</span>` : ""}</h2>
    <p class="aciklama">Kullanıcı no ${id}${o ? ` · ${o.onay} onay / ${o.ret} ret` : ""}</p>
    <h2>Bildirimler</h2>${U.length ? U.map(u => `<div class="metin-kutu"><b>${tarih(u.gonderim || u.olusturma)} · ${KADEME[u.kademe]} · ${{ taslak: "taslak", onaylandi: "onaylandı", gonderildi: "gönderildi", iptal: "gönderilmedi", hata: "hata" }[u.durum]}</b>${e(u.description)}</div>`).join("") : '<p class="soluk">Bildirim yok.</p>'}
    <h2 style="margin-top:22px">Şikayetler (${S.length})</h2>${S.map(s => sikayetKart(s, "goster")).join("") || '<p class="soluk">Şikayet yok.</p>'}`;
}

async function sikayet() {
  $("#icerik").innerHTML = `<h2>Tüm şikayetler</h2><p class="aciklama">Son 200 kayıt, filtreyle daralt.</p>
    <div class="filtre"><select id="f-tur"><option value="">Soru + cevap</option><option value="s">Soru şikayeti</option><option value="c">Cevap şikayeti</option></select>
    <select id="f-karar"><option value="">Tüm kararlar</option><option>ONAYLA</option><option>REDDET</option><option>HAVUZA_AKTAR</option></select>
    <input id="f-ara" placeholder="Şikayet no, ders ya da öğretmen"></div><div id="f-liste"></div>`;
  const yukle = async () => {
    let p = sb.from("d_sikayet").select("*").order("olusturma", { ascending: false }).limit(200);
    if ($("#f-tur").value) p = p.eq("tur", $("#f-tur").value);
    if ($("#f-karar").value) p = p.eq("son_karar", $("#f-karar").value);
    const a = $("#f-ara").value.trim();
    if (/^\d+$/.test(a)) p = p.eq("sikayet_id", +a); else if (a) p = p.or(`ders.ilike.%${a}%,ogretmen.ilike.%${a}%`);
    const L = await q(p);
    $("#f-liste").innerHTML = `<div class="tablo-sar"><table class="tablo"><tr><th>Tarih</th><th>Tür</th><th>Ders</th><th>Öğretmen</th><th>Karar</th></tr>
      ${L.map(s => `<tr class="tik" data-key="${e(s.key)}"><td>${tarih(s.olusturma)}</td><td>${s.tur === "s" ? "Soru" : "Cevap"} · ${s.sikayet_id}</td><td>${e(s.ders)}</td><td>${e(s.ogretmen)}</td>
        <td>${s.durum === "bekliyor" ? '<span class="etiket uyari">Bekliyor</span>' : `<span class="etiket ${s.son_karar === "REDDET" ? "" : "ok"}">${KARAR_ACIK[s.son_karar] || ""}</span>`}</td></tr>
        <tr hidden><td colspan="5"></td></tr>`).join("")}</table></div>`;
    $("#f-liste").querySelectorAll("tr.tik").forEach(t => t.onclick = () => {
      const alt = t.nextElementSibling; alt.hidden = !alt.hidden;
      if (!alt.hidden && !alt.firstElementChild.innerHTML) alt.firstElementChild.innerHTML = sikayetKart(L.find(s => s.key === t.dataset.key), "goster");
    });
  };
  let z; $("#f-ara").oninput = () => { clearTimeout(z); z = setTimeout(yukle, 350); };
  $("#f-tur").onchange = yukle; $("#f-karar").onchange = yukle; yukle();
}

window.git = git;
sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") girisGoster(); });
basla();
