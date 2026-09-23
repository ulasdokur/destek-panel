/* Tebeşir — solver destek sohbeti (destek.tahtaapp.com/tebesir).
 * Arka uç: takim-rehberi Supabase edge fonksiyonu `destek-poc` (herkese açık mod: imzalı oturum).
 * Kimlik tarayıcıdan GÖNDERİLMEZ; sunucu oturumdan okur. Tüm metinler textContent ile basılır. */
"use strict";

// Herkese açık (publishable) anahtar — gizli değil, satış panelinin yayınlanmış kodunda da var.
const SUPABASE_URL = "https://tnvzhtwnykjhdyssikgc.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudnpodHdueWtqaGR5c3Npa2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjYxMjUsImV4cCI6MjA4Njc0MjEyNX0.WG30hxLfXn01QKoD5u4gR7ok_ZsPbRmZ5CYAVKRLPMI";
const UC = `${SUPABASE_URL}/functions/v1/destek-poc`;
const OTURUM_ANAHTARI = "tebesir-oturum";
const SOHBET_ANAHTARI = "tebesir-sohbet";

const ARAC_ETIKET = {
  solver_profil: "Hesabınızı kontrol ediyorum",
  cevaplanan_sorular: "Cevaplarınızı arıyorum",
  telafi_gecmisi: "Telafi geçmişinize bakıyorum",
  soru_dogrula: "Sorunun ödeme kaydını açıyorum",
  talep_olustur: "Talebi oluşturuyorum",
  form_goster: "Formu hazırlıyorum",
};
const aracEtiket = (a) => ARAC_ETIKET[a] ?? "Kayıtlara bakıyorum";

const $ = (id) => document.getElementById(id);
const el = (etiket, ozellik = {}, ...cocuk) => {
  const e = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of cocuk) if (c) e.append(c);
  return e;
};
const oku = (depo, k) => { try { return JSON.parse(depo.getItem(k) ?? "null"); } catch { return null; } };
const yaz = (depo, k, v) => { try { v == null ? depo.removeItem(k) : depo.setItem(k, JSON.stringify(v)); } catch { /* gizli sekme */ } };

/* ── durum ── */
let tanim = null;                 // { konular, formlar } — sunucudan, tek kaynak
let oturum = oku(localStorage, OTURUM_ANAHTARI);   // { jeton, ad, bitis }
const s = Object.assign(
  { mesajlar: [], konusmaId: null, konu: null },
  oku(sessionStorage, SOHBET_ANAHTARI) ?? {},
);
let yaziyor = false, akan = "", adimlar = [], form = null, adaylar = null, formKuyrugu = null, adayBekleniyor = false;
let sistemNotu = "";
const kaydet = () => yaz(sessionStorage, SOHBET_ANAHTARI, { mesajlar: s.mesajlar, konusmaId: s.konusmaId, konu: s.konu });

/* ── ağ ── */
async function api(govde) {
  const r = await fetch(UC, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ANON, authorization: `Bearer ${ANON}` },
    body: JSON.stringify(govde),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(r.ok ? "Beklenmeyen yanıt." : `Servis yanıt vermedi (${r.status}).`); }
}
async function tanimAl() {
  if (tanim) return tanim;
  tanim = oku(sessionStorage, "tebesir-tanim");
  if (tanim) return tanim;
  const d = await api({ tebesir: { islem: "tanim" } });
  if (!d?.ok) throw new Error("Sayfa tanımı alınamadı.");
  tanim = { konular: d.konular, formlar: d.formlar };
  yaz(sessionStorage, "tebesir-tanim", tanim);
  return tanim;
}

/* ── ekranlar ── */
function oturumGecerli() { return oturum?.jeton && oturum.bitis > Date.now() + 60_000; }
function cikisYap(mesaj) {
  oturum = null; yaz(localStorage, OTURUM_ANAHTARI, null);
  s.mesajlar = []; s.konusmaId = null; s.konu = null; kaydet();
  girisGoster(mesaj);
}
function girisGoster(mesaj) {
  $("sohbet").hidden = true; $("cikis").hidden = true; $("giris").hidden = false;
  const h = $("telHata"); h.hidden = !mesaj; h.textContent = mesaj ?? "";
  $("tel").focus();
}
async function sohbetGoster() {
  $("giris").hidden = true; $("sohbet").hidden = false; $("cikis").hidden = false;
  try { await tanimAl(); } catch (e) { sistemNotu = e.message; }
  ciz();
}

/* ── giriş ── */
let sonTel = "", yenidenSayac = null;
function yenidenBaslat() {
  let kalan = 60; const b = $("kodYeniden"); b.disabled = true;
  clearInterval(yenidenSayac);
  const guncelle = () => { b.textContent = kalan > 0 ? `Yeniden gönder (${kalan})` : "Yeniden gönder"; b.disabled = kalan > 0; };
  guncelle();
  yenidenSayac = setInterval(() => { kalan--; guncelle(); if (kalan <= 0) clearInterval(yenidenSayac); }, 1000);
}
async function kodIste(tel) {
  const d = await api({ tebesir: { islem: "otp_iste", telefon: tel } });
  if (!d?.ok) throw new Error(d?.mesaj ?? "Kod gönderilemedi.");
  return d.mesaj;
}
$("telForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tel = $("tel").value.trim(), b = $("telGonder"), h = $("telHata");
  h.hidden = true;
  if (tel.replace(/\D/g, "").length < 10) { h.textContent = "Telefon numarasını 05xx xxx xx xx biçiminde yazın."; h.hidden = false; return; }
  b.disabled = true; b.textContent = "Gönderiliyor…";
  try {
    const mesaj = await kodIste(tel);
    sonTel = tel;
    $("kodBilgi").textContent = mesaj;
    $("kod").value = ""; $("kodHata").hidden = true;
    $("kodPencere").showModal(); $("kod").focus();
    yenidenBaslat();
  } catch (err) { h.textContent = err.message; h.hidden = false; }
  finally { b.disabled = false; b.textContent = "Kod gönder"; }
});
$("kodYeniden").addEventListener("click", async () => {
  const h = $("kodHata"); h.hidden = true;
  try { $("kodBilgi").textContent = await kodIste(sonTel); yenidenBaslat(); }
  catch (err) { h.textContent = err.message; h.hidden = false; }
});
$("kodKapat").addEventListener("click", () => $("kodPencere").close());
$("kod").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
$("kodForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const kod = $("kod").value, b = $("kodOnay"), h = $("kodHata");
  h.hidden = true;
  if (kod.length !== 6) { h.textContent = "6 haneli kodu girin."; h.hidden = false; return; }
  b.disabled = true;
  try {
    const d = await api({ tebesir: { islem: "otp_dogrula", telefon: sonTel, kod } });
    if (!d?.ok) throw new Error(d?.mesaj ?? "Kod doğrulanamadı.");
    oturum = { jeton: d.oturum, ad: d.solver?.ad ?? "", bitis: Date.now() + (d.sure_sn ?? 3600) * 1000 };
    yaz(localStorage, OTURUM_ANAHTARI, oturum);
    s.mesajlar = []; s.konusmaId = null; s.konu = null; kaydet();
    $("kodPencere").close();
    await sohbetGoster();
  } catch (err) { h.textContent = err.message; h.hidden = false; }
  finally { b.disabled = false; }
});
$("cikis").addEventListener("click", () => cikisYap());

/* ── sohbet çizimi ── */
const metinCek = (m) => typeof m.content === "string" ? m.content
  : Array.isArray(m.content) ? m.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim() : "";
const dolu = (t) => t.replace(/[.\s…]/g, "").length > 0;
const trTarih = (iso) => {
  const [y, a, g] = iso.split("T")[0].split("-");
  const saat = iso.includes("T") ? ` ${iso.split("T")[1].slice(0, 5)}` : "";
  return y && a && g ? `${g}/${a}/${y}${saat}` : iso;
};
const bugunISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
const gunOnce = (g) => new Date(Date.now() - g * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

function ciz() {
  const akisEl = $("akis");
  const altta = akisEl.scrollHeight - akisEl.scrollTop - akisEl.clientHeight < 80;
  akisEl.replaceChildren();
  const gorunur = s.mesajlar.filter((m) => dolu(metinCek(m)));

  // Açılış metni ekranda SABİT: model çalışmıyor, maliyeti yok.
  if (!gorunur.length) {
    const ad = (oturum?.ad ?? "").split(" ")[0];
    akisEl.append(el("section", { class: "acilis" },
      el("p", { text: `Merhaba${ad ? " " + ad : ""} Hocam, ben Tebeşir. Tahta'nın yapay zekâ destek hattıyım, size hangi konuda yardımcı olabilirim?` }),
      el("p", { class: "soluk", text: "Belirtmek isterim ki yayına yeni alındım, hâlâ geliştirme aşamasındayım. Derdinizi olabildiğince sade anlatırsanız daha isabetli yardımcı olurum." }),
      !s.konu && tanim ? el("div", { class: "konular" }, ...tanim.konular.map((k) =>
        el("button", { class: "konu", type: "button", disabled: yaziyor, onclick: () => konuSec(k) }, document.createTextNode(k.etiket)))) : null,
    ));
  }
  for (const m of gorunur) {
    const t = metinCek(m);
    const hoca = m.role === "user";
    // Form özeti: modele giden iç işaret ("— tür: x") ekranda sade başlığa dönüşüyor.
    const fm = hoca ? /^\[(.+?) formu dolduruldu — tür: [a-z_]+\]\n?/.exec(t) : null;
    if (fm) akisEl.append(el("div", { class: "balon hoca ozet" }, el("strong", { text: `${fm[1]} formu gönderildi` }),
      document.createTextNode("\n" + t.slice(fm[0].length))));
    else akisEl.append(el("div", { class: `balon ${hoca ? "hoca" : "bot"}`, text: t }));
  }
  for (const a of adimlar) {
    if (a.tip === "metin") akisEl.append(el("div", { class: "balon bot", text: a.metin }));
    else akisEl.append(el("div", { class: `adim${a.bitti ? " bitti" : ""}` }, el("span", { class: "isaret", "aria-hidden": "true" }), document.createTextNode(aracEtiket(a.arac))));
  }
  if (form) akisEl.append(formCiz());
  if (adaylar) akisEl.append(adayCiz());
  if (akan) akisEl.append(el("div", { class: "balon bot", text: akan }));
  if (adayBekleniyor) akisEl.append(el("div", { class: "yaziyor", text: "O tarihteki cevaplarınız getiriliyor…" }));
  else if (yaziyor && !akan && !adimlar.some((a) => a.tip === "arac" && !a.bitti)) akisEl.append(el("div", { class: "yaziyor", text: "Yanıt hazırlanıyor…" }));
  // Sohbet varken konu değişirse düğmeler en altta (üstte kalınca görünmüyordu).
  if (gorunur.length && !s.konu && tanim && !yaziyor) {
    akisEl.append(el("div", { class: "acilis" }, el("p", { text: "Hangi konuda devam edelim?" }),
      el("div", { class: "konular" }, ...tanim.konular.map((k) =>
        el("button", { class: "konu", type: "button", onclick: () => konuSec(k) }, document.createTextNode(k.etiket))))));
  }
  if (sistemNotu) akisEl.append(el("div", { class: "sistem", role: "status", text: sistemNotu }));
  if (s.konu && !gorunur.length && !form && !adaylar && !adayBekleniyor && !yaziyor) {
    akisEl.append(el("div", { class: "yaziyor", text: s.konu === "hesap" ? "Hesabınızda ne olduğunu yazın, bakayım." : "Yaşadığınız durumu yazabilirsiniz." }));
  }

  const k = tanim?.konular.find((x) => x.tur === s.konu);
  $("konuSatiri").hidden = !s.konu; $("konuEtiket").textContent = k?.etiket ?? "";
  const ta = $("mesaj");
  ta.disabled = !s.konu || yaziyor;
  ta.placeholder = !s.konu ? "Önce konu seçin" : "Mesajınızı yazın…";
  $("gonder").disabled = !s.konu || yaziyor || !ta.value.trim();
  if (altta || yaziyor) akisEl.scrollTop = akisEl.scrollHeight;
}

/* ── konu ve formlar ── */
function konuSec(k) {
  s.konu = k.tur; sistemNotu = ""; kaydet();
  const sablon = k.form ? tanim.formlar[k.form] : null;
  form = sablon ? { tur: k.form, ...sablon, deger: {} } : null;
  adaylar = null;
  ciz();
  if (!form) $("mesaj").focus();
}
$("konuDegistir").addEventListener("click", () => { s.konu = null; form = null; adaylar = null; kaydet(); ciz(); });

function formCiz() {
  const kutu = el("form", { class: "form-kutu", novalidate: true });
  kutu.append(el("h3", { text: form.baslik }), el("p", { class: "soluk", text: form.aciklama }));
  const hata = el("p", { class: "hata", role: "alert", hidden: true });
  for (const a of form.alanlar) {
    const id = `alan-${a.ad}`;
    const tip = a.tip === "tarih" ? "date" : a.tip === "tarih_saat" ? "datetime-local" : a.tip === "sayi" ? "number" : "text";
    const g = a.tip === "uzun"
      ? el("textarea", { id, rows: 3, maxlength: 1500, placeholder: a.ipucu ?? "" })
      : el("input", { id, type: tip, placeholder: a.ipucu ?? "", maxlength: tip === "text" ? 200 : undefined,
          max: a.tip === "tarih" ? bugunISO() : undefined, min: a.tip === "tarih" && a.enEskiGun ? gunOnce(a.enEskiGun) : undefined,
          inputmode: a.tip === "sayi" ? "numeric" : undefined });
    g.value = form.deger[a.ad] ?? "";
    g.addEventListener("input", () => { form.deger[a.ad] = g.value; });
    const lbl = el("label", { for: id }, document.createTextNode(a.etiket), a.zorunlu ? el("span", { class: "zorunlu", text: " *" }) : null);
    kutu.append(el("div", { class: "alan" }, lbl, g));
  }
  kutu.append(hata, el("div", { class: "satir" },
    el("button", { type: "button", class: "dugme-hayalet", onclick: () => { form = null; ciz(); } }, document.createTextNode("Vazgeç")),
    el("button", { type: "submit", class: "dugme", disabled: yaziyor }, document.createTextNode("Gönder")),
  ));
  kutu.addEventListener("submit", (e) => { e.preventDefault(); formGonder(hata); });
  return kutu;
}

function formGonder(hataEl) {
  const eksik = form.alanlar.filter((a) => a.zorunlu && !(form.deger[a.ad] ?? "").trim());
  if (eksik.length) { hataEl.textContent = `Eksik alan: ${eksik.map((a) => a.etiket).join(", ")}`; hataEl.hidden = false; return; }
  const a = form.alanlar.find((x) => x.tip === "tarih" && x.enEskiGun && form.deger[x.ad]);
  if (a && (form.deger[a.ad] > bugunISO() || form.deger[a.ad] < gunOnce(a.enEskiGun))) {
    hataEl.textContent = `Tarih son ${a.enEskiGun} gün içinde ve bugünden ileri olmamalı.`; hataEl.hidden = false; return;
  }
  const dolular = form.alanlar.filter((x) => (form.deger[x.ad] ?? "").trim());
  const ozet = `[${form.baslik} formu dolduruldu — tür: ${form.tur}]\n` + dolular.map((x) => {
    const ham = form.deger[x.ad].trim();
    return `${x.etiket}: ${x.tip === "tarih" || x.tip === "tarih_saat" ? `${trTarih(ham)} (${ham})` : ham}`;
  }).join("\n");
  const tarih = (form.deger.cevap_tarihi ?? "").trim();
  const veri = Object.fromEntries(dolular.map((x) => [x.ad, form.deger[x.ad].trim()]));
  const { tur, adaySor } = form;
  form = null;
  if (adaySor && tarih) { adaylariGetir(tarih, ozet); return; }
  // Teknik arıza ve özel derste karar yok: kaydı sunucu açıyor.
  gonder(ozet, { form_kaydi: { tur, veri } });
}

async function adaylariGetir(tarih, ozet) {
  adayBekleniyor = true; ciz();
  try {
    const d = await api({ oturum: oturum.jeton, mesajlar: [], konusmaId: s.konusmaId, konu: s.konu, adaylar: { tarih } });
    if (d?.error === "oturum_gecersiz") return cikisYap(d.message);
    if (d?.error) throw new Error(d.message ?? d.error);
    if (d.konusmaId) { s.konusmaId = d.konusmaId; kaydet(); }
    const liste = d.adaylar?.sorular ?? [];
    adayBekleniyor = false;
    if (liste.length === 1) return gonder(`${ozet}\n${adaySatiri(liste[0])}`);
    if (!liste.length) return gonder(`${ozet}\n(o tarihte panelde cevap görünmüyor)`);
    adaylar = liste; formKuyrugu = ozet; ciz();
  } catch (e) {
    adayBekleniyor = false;
    gonder(ozet);   // liste gelmediyse sohbetten devam
  }
}
const adaySatiri = (a) => `Seçilen soru: ${a.soru_id} · ${a.tarih}${a.ders ? ` · ${a.ders}` : ""}${a.durum ? ` · ${a.durum}` : ""}`;
function adayCiz() {
  return el("div", { class: "form-kutu" },
    el("h3", { text: "Hangi soru için?" }),
    el("p", { class: "soluk", text: "Saatler sorunun soruluş saatidir, cevapladığınız saat biraz sonra olabilir." }),
    ...adaylar.map((a) => el("button", { type: "button", class: "aday", disabled: yaziyor, onclick: () => {
      const ozet = formKuyrugu ?? ""; adaylar = null; formKuyrugu = null; gonder(`${ozet}\n${adaySatiri(a)}`);
    } }, document.createTextNode(a.tarih), el("small", { text: `${a.ders ?? ""}${a.durum ? ` · ${a.durum}` : ""}` }))),
  );
}

/* ── mesaj gönderme (akışlı, patlarsa düz JSON) ── */
async function gonder(metin, ek = {}) {
  metin = String(metin ?? "").trim();
  if (!metin || yaziyor || !oturumGecerli()) { if (!oturumGecerli()) cikisYap("Oturumunuzun süresi doldu, lütfen yeniden giriş yapın."); return; }
  const onceki = s.mesajlar;
  s.mesajlar = [...s.mesajlar, { role: "user", content: metin }];
  yaziyor = true; akan = ""; adimlar = []; sistemNotu = ""; form = null;
  ciz();
  const govde = { oturum: oturum.jeton, mesajlar: s.mesajlar, konusmaId: s.konusmaId, konu: s.konu, ...ek };
  const bitir = (d) => {
    if (d?.error === "oturum_gecersiz") return cikisYap(d.message);
    if (d?.error) { s.mesajlar = onceki; sistemNotu = d.message ?? "Bir sorun oluştu, tekrar dener misiniz?"; if (!ek.form_kaydi) $("mesaj").value = metin; return; }
    s.mesajlar = d.mesajlar ?? s.mesajlar;
    if (d.konusmaId) s.konusmaId = d.konusmaId;
    if (d.formlar?.length) {
      const f = d.formlar[d.formlar.length - 1];
      form = { ...f, deger: Object.fromEntries(f.alanlar.map((a) => [a.ad, String(f.on_dolu?.[a.ad] ?? "")])) };
    }
    kaydet();
  };
  try {
    const r = await fetch(UC, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: ANON, authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ ...govde, akis: true }),
    });
    if (!r.headers.get("content-type")?.includes("event-stream")) { bitir(await r.json()); return; }
    const okuyucu = r.body.getReader(), cozucu = new TextDecoder();
    let artik = "", bitti = false;
    while (true) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      artik += cozucu.decode(value, { stream: true });
      const parcalar = artik.split("\n\n"); artik = parcalar.pop() ?? "";
      for (const p of parcalar) {
        const satir = p.split("\n").find((l) => l.startsWith("data:"));
        if (!satir) continue;
        let o; try { o = JSON.parse(satir.slice(5).trim()); } catch { continue; }
        if (o.t === "metin") { akan += String(o.d ?? ""); }
        else if (o.t === "geri_al") { akan = ""; }
        else if (o.t === "arac_basladi") {
          const gelen = akan.trim(); akan = "";
          if (gelen) adimlar.push({ tip: "metin", metin: gelen });
          adimlar.push({ tip: "arac", arac: String(o.d?.arac ?? ""), bitti: false });
        } else if (o.t === "arac") {
          const a = adimlar.find((x) => x.tip === "arac" && x.arac === o.d?.arac && !x.bitti);
          if (a) a.bitti = true;
        } else if (o.t === "son") { bitti = true; bitir(o.d); }
        ciz();
      }
    }
    if (!bitti) throw new Error("akış yarıda kesildi");
  } catch (e) {
    // Akış olmadıysa bir kez düz JSON yolunu dene. Form kaydında tekrar deneme YOK (mükerrer kayıt).
    if (ek.form_kaydi) { s.mesajlar = onceki; sistemNotu = "Bağlantı koptu. Kaydınızın düşüp düşmediğini görmek için birkaç saniye sonra tekrar deneyin."; }
    else {
      try { bitir(await api(govde)); }
      catch { s.mesajlar = onceki; $("mesaj").value = metin; sistemNotu = "Bağlantı sorunu oluştu, mesajınızı tekrar gönderir misiniz?"; }
    }
  } finally {
    yaziyor = false; akan = ""; adimlar = []; ciz();
  }
}

$("mesajForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const ta = $("mesaj"), t = ta.value.trim();
  if (!t) return;
  ta.value = ""; ta.style.height = "";
  gonder(t);
});
$("mesaj").addEventListener("input", (e) => {
  const ta = e.target; ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  $("gonder").disabled = !s.konu || yaziyor || !ta.value.trim();
});
$("mesaj").addEventListener("keydown", (e) => {
  // Masaüstünde Enter gönderir, Shift+Enter satır; dokunmatikte Enter satır atlar.
  if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); $("mesajForm").requestSubmit(); }
});

/* ── başlat ── */
if (oturumGecerli()) sohbetGoster();
else { if (oturum) cikisYap(); else girisGoster(); }
