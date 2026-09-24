// Tahta Destek Paneli. Veri Supabase'de (d_ tabloları), yazma sadece RPC'lerle.
// Panel admin.tahtaapp.com'a bağlanmaz: kararlar kaydedilir, otomatik kontrol (20 dk'da bir, Mac) admin paneline işler.
// Görseller Tahta'nın kendi CDN'inden (cloudfront) doğrudan, sadece görünür olunca yüklenir; bu panel görsel depolamaz.
const SB_URL = "https://rbjrnevngfuribasrnph.supabase.co";
const SB_ANON = "sb_publishable_yK1dNA6CGKIQ88U3gp53xA_nBLQGNVJ";
const sb = window.supabase.createClient(SB_URL, SB_ANON);
const ADMIN = "https://admin.tahtaapp.com";

const $ = (s, el = document) => el.querySelector(s);
const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KADEME = { F: "Format hatırlatması", Y: "Yapay zekâ uyarısı", G: "Genel uyarı", PASIF: "Hesabı pasife alma", AKTIF: "Hesap yeniden açıldı", EKSI: "Puan eksiye düştü" };
const KAT = { yapay_zeka: "yapay zekâ", dijital_metin: "dijital metin", soru_ustune: "soru üstüne yazma", yanlis_cevap: "yanlış cevap", okunaklilik: "okunaklılık", eksik_aciklama: "eksik açıklama", diger: "diğer" };
const GERI_AL_SN = 15;
let ben = null, sekme = "ozet";

// karar adları şikayet türüne göre (CS için açık)
const kararAdi = (tur, k) => tur === "s"
  ? ({ ONAYLA: "Onayla · soru kaldırılsın", REDDET: "Reddet · soru uygun", HAVUZA_AKTAR: "Doğru derse aktar" }[k] || k)
  : ({ ONAYLA: "Onayla · öğrenci haklı", REDDET: "Reddet · öğretmen haklı" }[k] || k);
const sonucAdi = (tur, k) => tur === "s"
  ? ({ ONAYLA: "Soru kaldırıldı", REDDET: "Soru uygun bulundu", HAVUZA_AKTAR: "Derse aktarıldı" }[k] || k)
  : ({ ONAYLA: "Öğrenci haklı", REDDET: "Öğretmen haklı", TEMIZ: "Temiz", SORUNLU: "Sorunlu", YZ_KESIN: "Yapay zekâ (kesin)" }[k] || k);
const sonucRenk = k => ({ ONAYLA: "ok", HAVUZA_AKTAR: "ok", REDDET: "", TEMIZ: "ok", SORUNLU: "uyari", YZ_KESIN: "hata" }[k] ?? "");

function tarih(t) { if (!t) return ""; return new Date(t).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function haftaNo(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const g = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - g); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, "0")}`; }
async function q(p) { const { data, error } = await p; if (error) { bildir("Hata: " + error.message); throw error; } return data; }
const kisiLink = (seo, ad) => ad ? (seo ? `<a href="${ADMIN}/User/Detail/${e(seo)}" target="_blank" rel="noopener">${e(ad)}</a>` : e(ad)) : '<span class="soluk">—</span>';
const soruLink = (qid, yazi = "Soruyu admin panelde aç") => qid ? `<a href="${ADMIN}/Question/Detail/${qid}" target="_blank" rel="noopener">${yazi}</a>` : "";
const baslik = (b, a) => `<div class="ust-cubuk"><div><h2>${b}</h2><p class="aciklama">${a}</p></div><button class="yardim-btn" title="Bu sayfa nasıl kullanılır?" onclick="rehberBaslat()"><i data-lucide="circle-help"></i></button></div>`;
const ikon = () => window.lucide && lucide.createIcons();

// ---------- toast + geri al ----------
function toast(baslik_, alt = "", geriAl = null) {
  const t = document.createElement("div"); t.className = "toast";
  t.innerHTML = `<div class="t-metin"><b>${e(baslik_)}</b>${alt ? `<span>${e(alt)}</span>` : ""}</div>${geriAl ? `<button class="geri-al">Geri al (${GERI_AL_SN})</button>` : ""}`;
  $("#toastlar").appendChild(t);
  let kalan = GERI_AL_SN, bitti = false;
  const kapat = () => { if (bitti) return; bitti = true; clearInterval(say); t.remove(); };
  const say = setInterval(() => { kalan--; const b = t.querySelector(".geri-al"); if (b) b.textContent = `Geri al (${kalan})`; if (kalan <= 0) kapat(); }, 1000);
  if (!geriAl) { clearInterval(say); setTimeout(kapat, 3500); }
  t.querySelector(".geri-al")?.addEventListener("click", async () => { kapat(); await geriAl(); });
}
const bildir = m => toast(m);

// ---------- galeri ----------
let galeri = [], gi = 0;
function galeriAc(liste, i) { galeri = liste; gi = i; galeriCiz(); $("#buyut").hidden = false; }
function galeriCiz() {
  const u = galeri[gi], vid = /\.(mp4|mov)(\?|$)/i.test(u), cok = galeri.length > 1;
  $("#buyut").innerHTML = `<div class="g-pencere"><div class="g-ust"><span>${cok ? `${gi + 1} / ${galeri.length}` : ""}</span><button class="g-kapat" title="Kapat (Esc)">×</button></div>
    <div class="g-govde"><span class="soluk" style="position:absolute">Yükleniyor…</span>${vid ? `<video src="${e(u)}" controls autoplay></video>` : `<img src="${e(u)}" alt="">`}
    ${cok ? '<button class="g-ok sol" data-y="-1">‹</button><button class="g-ok sag" data-y="1">›</button>' : ""}</div></div>`;
}
const galeriKapat = () => { $("#buyut").hidden = true; $("#buyut").innerHTML = ""; };
$("#buyut").onclick = ev => {
  const y = ev.target.closest(".g-ok"); if (y) { gi = (gi + +y.dataset.y + galeri.length) % galeri.length; return galeriCiz(); }
  if (ev.target.closest(".g-kapat") || ev.target.id === "buyut") galeriKapat();
};
document.addEventListener("keydown", ev => {
  if ($("#buyut").hidden) return;
  if (ev.key === "Escape") galeriKapat();
  if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { gi = (gi + (ev.key === "ArrowRight" ? 1 : -1) + galeri.length) % galeri.length; galeriCiz(); }
});
document.addEventListener("click", ev => {
  const m = ev.target.closest("[data-galeri]"); if (!m) return;
  const L = JSON.parse(m.closest("[data-medya]").dataset.medya); galeriAc(L, +m.dataset.galeri);
});
// uzun metin: 2 satır + "devamını gör"
function klampBagla(kok = document) {
  kok.querySelectorAll(".klamp:not([data-b])").forEach(k => {
    k.dataset.b = 1; if (k.scrollHeight <= k.clientHeight + 2) return;
    const b = document.createElement("button"); b.className = "devam"; b.textContent = "Devamını gör";
    b.onclick = () => { k.classList.toggle("acik"); b.textContent = k.classList.contains("acik") ? "Kısalt" : "Devamını gör"; };
    k.after(b);
  });
}

// ---------- giriş ----------
async function basla() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return girisGoster();
  const y = await sb.from("d_yetkili").select("ad,rol").eq("email", session.user.email.toLowerCase()).maybeSingle();
  if (!y.data) { await sb.auth.signOut(); return girisGoster("Bu hesabın panele yetkisi yok."); }
  ben = { ...y.data, email: session.user.email };
  $("#giris").hidden = true; $("#uygulama").hidden = false; $("#k-ad").textContent = ben.ad;
  $("#k-rol").textContent = ben.rol === "yonetici" ? "Yönetici" : "Destek";
  ikon();
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
$("#sekmeler").onclick = ev => {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.classList.contains("grup-bas")) return b.parentElement.classList.toggle("acik");
  if (b.dataset.s) git(b.dataset.s);
};
const menuKapat = () => { $("#yan").classList.remove("acik"); $("#perde").hidden = true; };
$("#menu-ac").onclick = () => { $("#yan").classList.add("acik"); $("#perde").hidden = false; };
$("#perde").onclick = menuKapat;
function git(s, alt) {
  sekme = s; location.hash = alt ? `${s}/${alt}` : s;
  document.querySelectorAll("#sekmeler button[data-s]").forEach(b => b.classList.toggle("secili", b.dataset.s === s));
  document.querySelectorAll("#sekmeler .grup").forEach(g => { const ic = !!g.querySelector(`button[data-s="${s}"]`); g.classList.toggle("aktif", ic); if (ic) g.classList.add("acik"); });
  menuKapat(); window.scrollTo(0, 0);
  const f = { ozet, gunluk, bekleyen, kontrol, uyari, ogretmen, sikayet, basvuru, takip, ogrenci, eksi }[s] || ozet;
  $("#icerik").innerHTML = '<p class="aciklama">Yükleniyor…</p>';
  Promise.resolve(f(alt)).then(() => { ikon(); klampBagla(); });
}
async function rozetler() {
  const [b, k, u, kb] = await Promise.all([
    sb.from("d_sikayet").select("key,d_karar(id,tip,uygulandi)").eq("durum", "bekliyor"),
    sb.from("d_sikayet").select("key,d_karar(id,tip)").eq("kontrol_hafta", haftaNo()),
    sb.from("d_uyari").select("id", { count: "exact", head: true }).eq("durum", "taslak"),
    sb.from("d_basvuru").select("id", { count: "exact", head: true }).eq("kontrol_hafta", haftaNo()).is("kontrol_secim", null),
  ]);
  $("#r-bekleyen").textContent = (b.data || []).filter(x => !x.d_karar.some(k => k.tip === "bekleyen")).length || "";
  $("#r-kontrol").textContent = ((k.data || []).filter(x => !x.d_karar.some(k => k.tip === "kontrol")).length + (kb.count || 0)) || "";
  $("#r-uyari").textContent = u.count || "";
  const top = ids => ids.reduce((a, i) => a + (+$(i).textContent || 0), 0) || "";
  $("#r-sikayet-grup").textContent = top(["#r-bekleyen", "#r-kontrol"]); $("#r-ogretmen-grup").textContent = top(["#r-uyari"]);
}

// ---------- medya çifti (soru | cevap) ----------
function medya(soruL, cevapL, video, cevapEtiket, tekli) {
  const hepsi = [...(soruL || []), ...(cevapL || []), ...(video ? [video] : [])];
  const kutu = (L, etiket, mor, bas, vid) => {
    if (vid) return `<div class="m-kutu" data-galeri="${bas}"><span class="m-chip ${mor ? "mor" : ""}">${e(etiket)}</span><video src="${e(vid)}#t=0.5" preload="metadata" muted></video><div class="m-oynat"><span>▶</span></div></div>`;
    if (!L || !L.length) return `<div class="m-kutu bos-m">${e(etiket)}: görsel yok</div>`;
    return `<div class="m-kutu" data-galeri="${bas}"><span class="m-chip ${mor ? "mor" : ""}">${e(etiket)}</span><img src="${e(L[0])}" loading="lazy" alt="">${L.length > 1 ? `<span class="m-ek">+${L.length - 1}</span>` : ""}</div>`;
  };
  const ns = (soruL || []).length;
  return `<div class="medya ${tekli ? "tek" : ""}" data-medya='${e(JSON.stringify(hepsi))}'>${kutu(soruL, "Soru", false, 0)}${tekli ? "" : kutu(cevapL, cevapEtiket, true, ns, !cevapL?.length && video)}</div>`;
}

// ---------- şikayet kartı (kompakt) ----------
function sikayetKart(s, mod) {
  const cevapli = s.tur === "c";
  const bilgi = cevapli
    ? [["Öğrencinin seçimi", [s.sebep, (s.alt_sebep || []).join(", ")].filter(Boolean).join(" · ")], ["Öğrencinin notu", s.ogrenci_notu],
       ["Yorumlar", (s.yorumlar || []).join(" / ")], ["Sorudaki açıklama", s.soru_aciklamasi], ["Öğretmenin açıklaması", s.cevap_aciklamasi], ["Videodaki konuşma", s.ses_dokumu && s.ses_dokumu.slice(0, 400)]]
    : [["Şikayet sebebi", s.sebep], ["Öğrencinin açıklaması", s.ogrenci_notu]];
  const durum = s.durum === "islendi" ? `<span class="etiket ${sonucRenk(s.son_karar)}">${sonucAdi(s.tur, s.son_karar)}</span>` : '<span class="etiket uyari">Karar bekliyor</span>';
  const hedef = s.hedef_ders ? ` → ${e(s.hedef_ders)}` : "";
  let karar = `<div class="sk-karar"><div class="sk-karar-satir"><span class="etiket">İlk inceleme: ${kararAdi(s.tur, s.ajan_karar).split(" · ")[0]}${s.ajan_karar === "HAVUZA_AKTAR" ? hedef : ""}</span>
    ${s.emin_degil ? '<span class="etiket uyari" data-ipucu="İlk inceleme bu kayıtta emin olamadı, bu yüzden karar sana bırakıldı.">emin değil</span>' : ""}
    ${s.dogru_cevap ? `<span class="soluk">Doğru cevap: <b>${e(s.dogru_cevap)}</b>${s.ogretmen_cevabi ? ` · Öğretmenin cevabı: <b>${e(s.ogretmen_cevabi)}</b>` : ""}</span>` : ""}</div>
    <div class="klamp">${e(s.gerekce)}</div></div>`;
  if (s.oneri) karar += `<div class="sk-karar"><div class="sk-karar-satir"><span class="etiket" data-ipucu="İlk inceleme emin olamayınca kayda ikinci kez bakıldı; bu, o ikinci bakışın önerisi.">İkinci kontrol: ${kararAdi(s.tur, s.oneri).split(" · ")[0]}</span></div><div class="klamp">${e(s.oneri_gerekce)}</div></div>`;
  let alt = "";
  if (mod === "bekleyen") {
    const sec = ["ONAYLA", "REDDET"].concat(!cevapli && s.hedef_lecture_id ? ["HAVUZA_AKTAR"] : []);
    alt = `<div class="aksiyon">${sec.map(x => `<button class="secim ${x === "REDDET" ? "ret" : "onay"}" data-v="${x}">${kararAdi(s.tur, x)}${x === "HAVUZA_AKTAR" ? hedef : ""}</button>`).join("")}
      <input placeholder="Not (isteğe bağlı): neden bu karar?"><button class="birincil kucuk kaydet">Kaydet</button></div>`;
  } else if (mod === "kontrol") {
    alt = `<div class="aksiyon"><button class="secim onay" data-v="DOGRU">Karar doğru</button><button class="secim ret" data-v="YANLIS">Karar yanlış</button>
      <input placeholder="Yanlışsa neden? (zorunlu)"><button class="birincil kucuk kaydet">Kaydet</button></div>`;
  }
  const takipMi = String(s.key).startsWith("t:");
  return `<section class="kart sk" data-key="${e(s.key)}" data-mod="${mod}" data-tur="${s.tur}">
    <div class="sk-ust"><span class="etiket">${takipMi ? "Yakın takip" : cevapli ? "Cevap şikayeti" : "Soru şikayeti"}</span><b>${e(s.ders)}</b>
      <span class="soluk">${tarih(s.olusturma)}${takipMi ? "" : ` · şikayet no ${s.sikayet_id}`}</span><span class="sag">${durum}</span></div>
    <div class="sk-kisiler">
      ${takipMi ? "" : `<span><b>Öğrenci:</b> ${kisiLink(s.ogrenci_seo, s.ogrenci)}</span>`}
      <span><b>${cevapli ? "Öğretmen" : "Şikayet eden öğretmen"}:</b> ${kisiLink(s.ogretmen_seo, s.ogretmen)}${s.ogretmen_id ? ` · <a href="#" onclick="event.preventDefault();git('ogretmen','${s.ogretmen_id}')">paneldeki geçmişi</a>` : ""}</span>
      <span>${soruLink(s.question_id)}</span></div>
    ${bilgi.some(x => x[1]) ? `<dl class="sk-bilgi">${bilgi.filter(x => x[1]).map(([a, b]) => `<dt>${a}</dt><dd>${e(b)}</dd>`).join("")}</dl>` : ""}
    ${medya(s.soru_url, s.cevap_url, s.video_url, cevapli ? (s.ogretmen || "Cevap") : "", !cevapli)}
    ${karar}${alt}</section>`;
}
function kartlariBagla(kok, yenile) {
  kok.querySelectorAll("section.sk[data-mod=bekleyen],section.sk[data-mod=kontrol]").forEach(kart => {
    let secim = null;
    kart.querySelectorAll(".secim").forEach(b => b.onclick = () => { secim = b.dataset.v; kart.querySelectorAll(".secim").forEach(x => x.classList.toggle("secili", x === b)); });
    const k = kart.querySelector(".kaydet");
    k.onclick = async () => {
      if (!secim) return bildir("Önce bir seçim yap.");
      const not = kart.querySelector(".aksiyon input").value.trim(), tip = kart.dataset.mod === "kontrol" ? "kontrol" : "bekleyen", key = kart.dataset.key;
      if (tip === "kontrol" && secim === "YANLIS" && not.length < 3) return bildir("Yanlış dediysen kısaca nedenini yaz.");
      k.disabled = true;
      const { error } = await sb.rpc("d_karar_ver", { p_key: key, p_tip: tip, p_secim: secim, p_not: not });
      k.disabled = false;
      if (error) return bildir(error.message === "zaten_islendi" ? "Bu kayıt zaten işlenmiş." : "Kaydedilemedi: " + error.message);
      kart.classList.add("gidiyor"); setTimeout(() => { kart.remove(); bosKontrol(kok); }, 250); rozetler();
      toast(tip === "kontrol" ? "Kontrol kaydedildi" : "Karar kaydedildi", tip === "kontrol" ? "Teşekkürler." : "En geç 20 dakika içinde admin paneline işlenecek.", async () => {
        const r = await sb.rpc("d_karar_geri_al", { p_key: key, p_tip: tip });
        if (r.error) return bildir("Geri alınamadı: karar işlenmiş olabilir.");
        bildir("Geri alındı."); rozetler(); yenile && yenile();
      });
    };
  });
}
function bosKontrol(kok) { if (!kok.querySelector("section.sk[data-mod]") && kok.querySelector(".bos-yer")) kok.querySelector(".bos-yer").innerHTML = '<div class="bos">Hepsi bitti. 👍</div>'; }

// ---------- özet ----------
async function ozet() {
  const gun = new Date(); gun.setHours(0, 0, 0, 0);
  const [dur, turlar, bugun, bek, taslak, pasifN, kk, bk] = await Promise.all([
    q(sb.from("d_durum").select("*")),
    q(sb.from("d_tur").select("*").order("zaman", { ascending: false }).limit(15)),
    q(sb.from("d_sikayet").select("tur,son_karar,durum").gte("olusturma", gun.toISOString())),
    sb.from("d_sikayet").select("key", { count: "exact", head: true }).eq("durum", "bekliyor"),
    sb.from("d_uyari").select("id", { count: "exact", head: true }).eq("durum", "taslak"),
    sb.from("d_ogretmen").select("id", { count: "exact", head: true }).eq("durum", "pasif"),
    q(sb.from("d_karar").select("secim").eq("tip", "kontrol")),
    q(sb.from("d_basvuru").select("kontrol_secim").not("kontrol_secim", "is", null)),
  ]);
  const D = Object.fromEntries(dur.map(x => [x.k, x]));
  const kontrolN = kk.length + bk.length, dogruN = kk.filter(x => x.secim === "DOGRU").length + bk.filter(x => x.kontrol_secim === "DOGRU").length;
  const dogruluk = kontrolN ? Math.round(dogruN / kontrolN * 100) : null;
  const son = D.son_gonderim ? new Date(D.son_gonderim.zaman) : null;
  const dk = son ? Math.round((Date.now() - son) / 60000) : null;
  const oturum = D.oturum?.v?.durum, say = f => bugun.filter(f).length;
  const kutu = (s, a, cls = "", id = "") => `<div class="kutu ${cls}" ${id ? `id="${id}"` : ""}><div class="s">${s}</div><div class="e">${a}</div></div>`;
  $("#icerik").innerHTML = baslik("Özet", "Günün durumu tek bakışta. Şikayetler 20 dakikada bir otomatik kontrol edilir; bu panelde verdiğin kararlar da o kontrolde admin paneline işlenir.") + `
    <div class="kutular">
      ${kutu(dk === null ? "—" : dk < 60 ? dk + " dk" : Math.round(dk / 60) + " sa", "son otomatik kontrolden bu yana", dk !== null && dk > 50 ? "uyari" : "", "oz-kontrol")}
      ${kutu(oturum === "dustu" ? "Kopuk" : "Bağlı", "admin paneli bağlantısı", oturum === "dustu" ? "hata" : "", "oz-baglanti")}
      ${kutu(bugun.length, "bugün incelenen şikayet")}
      ${kutu(say(x => x.son_karar === "ONAYLA" || x.son_karar === "HAVUZA_AKTAR") + " / " + say(x => x.son_karar === "REDDET"), "bugün onay / ret")}
      ${kutu(bek.count ?? 0, "kararını bekleyen", bek.count ? "uyari" : "", "oz-bekleyen")}
      ${kutu(taslak.count ?? 0, "onay bekleyen uyarı", taslak.count ? "uyari" : "")}
      ${kutu(pasifN.count ?? 0, "pasif öğretmen")}
      ${kutu(dogruluk === null ? "—" : "%" + dogruluk, `otomatik karar doğruluğu (${kontrolN} kontrol)`, dogruluk !== null && dogruluk < 90 ? "uyari" : "", "oz-dogruluk")}
    </div>
    <h2 id="oz-kontroller">Son otomatik kontroller</h2>
    ${turlar.length ? turlar.map(t => `<div class="kart"><div class="kart-ust"><b>${tarih(t.zaman)}</b>
      <span class="soluk">${t.soru_n + t.cevap_n} şikayet · ${t.onay} onay · ${t.ret} ret${t.havuz ? " · " + t.havuz + " derse aktarma" : ""}${t.bekleyen ? " · " + t.bekleyen + " karar bekliyor" : ""}</span></div>
      ${t.ozet ? `<details><summary>Neler oldu</summary><pre class="ozet">${e(t.ozet)}</pre></details>` : ""}</div>`).join("") : '<div class="bos">Henüz kontrol yapılmadı.</div>'}`;
}

async function tumSikayetler(gun) {
  const s = new Date(Date.now() - gun * 864e5).toISOString(); let L = [], i = 0;
  while (true) {
    const d = await q(sb.from("d_sikayet").select("key,tur,son_karar,durum,olusturma,ogretmen,ogretmen_id,gerekce,question_id,ogrenci,ogrenci_id,ogrenci_seo").gte("olusturma", s).order("olusturma").range(i, i + 999));
    L = L.concat(d); if (d.length < 1000) break; i += 1000;
  }
  return L;
}
async function gunluk() {
  const L = await tumSikayetler(30), G = {};
  for (const s of L) {
    const g = s.olusturma.slice(0, 10), o = G[g] ||= { s: 0, c: 0, onay: 0, ret: 0, havuz: 0, bek: 0 };
    o[s.tur]++; if (s.durum === "bekliyor") o.bek++; else if (s.son_karar === "ONAYLA") o.onay++; else if (s.son_karar === "REDDET") o.ret++; else if (s.son_karar === "HAVUZA_AKTAR") o.havuz++;
  }
  const gunler = Object.keys(G).sort().reverse(), mx = Math.max(1, ...gunler.map(g => G[g].s + G[g].c)), top = k => gunler.reduce((a, g) => a + G[g][k], 0);
  $("#icerik").innerHTML = baslik("Günlük", "Son 30 günde her gün kaç şikayet incelendi ve nasıl sonuçlandı. Onay: şikayet eden haklı bulundu. Ret: şikayet haksız. Derse aktarma: soru yanlış derse yüklenmişti, doğru derse taşındı.") + `
    <div class="kutular" id="gn-kutular">
      <div class="kutu"><div class="s">${top("s") + top("c")}</div><div class="e">toplam şikayet (${top("s")} soru, ${top("c")} cevap)</div></div>
      <div class="kutu"><div class="s">${top("onay")}</div><div class="e">onaylandı</div></div>
      <div class="kutu"><div class="s">${top("ret")}</div><div class="e">reddedildi</div></div>
      <div class="kutu"><div class="s">${top("havuz")}</div><div class="e">doğru derse aktarıldı</div></div></div>
    <div class="tablo-sar" id="gn-tablo"><table class="tablo sik"><tr><th>Gün</th><th>Gelen</th><th>Soru / cevap</th><th>Onay</th><th>Ret</th><th>Derse aktarma</th><th>Bekleyen</th><th style="width:28%"></th></tr>
    ${gunler.map(g => { const o = G[g], n = o.s + o.c; return `<tr><td>${new Date(g + "T12:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" })}</td><td><b>${n}</b></td><td>${o.s} / ${o.c}</td><td>${o.onay}</td><td>${o.ret}</td><td>${o.havuz}</td><td>${o.bek || ""}</td>
      <td><div class="cubuk" style="width:${Math.round(n / mx * 100)}%"><span style="width:${n ? Math.round((o.onay + o.havuz) / n * 100) : 0}%"></span></div></td></tr>`; }).join("")}</table></div>
    <p class="soluk" style="margin-top:8px">Çubuğun uzunluğu günün şikayet sayısı; koyu kısmı onaylanan + derse aktarılan.</p>`;
}

// ---------- kararını bekleyenler ----------
async function bekleyen() {
  const L = await q(sb.from("d_sikayet").select("*,d_karar(*)").eq("durum", "bekliyor").order("olusturma"));
  const acik = L.filter(s => !s.d_karar.some(k => k.tip === "bekleyen")), sirada = L.length - acik.length;
  $("#icerik").innerHTML = baslik("Kararını bekleyenler", "Otomatik incelemenin emin olamadığı şikayetler burada senin kararını bekler. Soru ve cevap görsellerine bak, bir karar seç, istersen not yaz ve Kaydet'e bas. Kayıt ekrandan kalkar, 15 saniye içinde geri alabilirsin; en geç 20 dakika içinde admin paneline işlenir.") + `
    ${sirada ? `<div class="bilgi-serit"><i data-lucide="clock"></i>${sirada} kararın admin paneline işlenmeyi bekliyor.</div>` : ""}
    <div class="bos-yer">${acik.length ? acik.map(s => sikayetKart(s, "bekleyen")).join("") : '<div class="bos">Bekleyen kayıt yok. 👍</div>'}</div>`;
  kartlariBagla($("#icerik"), bekleyen);
}

// ---------- haftalık kontrol ----------
async function kontrol() {
  const h = haftaNo();
  const [L, B] = await Promise.all([q(sb.from("d_sikayet").select("*,d_karar(*)").eq("kontrol_hafta", h).order("olusturma")), q(sb.from("d_basvuru").select("*").eq("kontrol_hafta", h).order("id"))]);
  const acik = L.filter(s => !s.d_karar.some(k => k.tip === "kontrol")), bacik = B.filter(b => !b.kontrol_secim);
  $("#icerik").innerHTML = baslik("Haftalık kontrol", "Otomatik kararların doğru olup olmadığını ölçmek için her hafta rastgele birkaç karar seçilir. Her birine bak: karar doğruysa \"Karar doğru\", yanlışsa \"Karar yanlış\" seç ve nedenini yaz. Yazdığın neden kurallara eklenir ve sonraki kararlarda dikkate alınır. Yanlış bir kararı admin panelinde ayrıca elle düzeltmen gerekir.") + `
    <div class="bilgi-serit"><i data-lucide="list-checks"></i>Şikayetler: ${L.length - acik.length}/${L.length} · Solver başvuruları: ${B.length - bacik.length}/${B.length} tamamlandı.</div>
    <h2>Şikayet kararları</h2><div class="bos-yer">${acik.length ? acik.map(s => sikayetKart(s, "kontrol")).join("") : '<div class="bos">Bu haftanın şikayet kontrolleri bitti. 👍</div>'}</div>
    <h2>Solver başvuru kararları</h2><div class="bos-yer b-yer">${bacik.length ? bacik.map(b => basvuruKart(b, true)).join("") : '<div class="bos">Bu haftanın başvuru kontrolleri bitti. 👍</div>'}</div>`;
  kartlariBagla($("#icerik"), kontrol); basvuruBagla(kontrol);
}

// ---------- uyarılar ----------
async function uyari() {
  const [acik, gecmis] = await Promise.all([
    q(sb.from("d_uyari").select("*").in("durum", ["taslak", "onaylandi"]).order("id")),
    q(sb.from("d_uyari").select("*").in("durum", ["gonderildi", "iptal", "hata"]).order("id", { ascending: false }).limit(300)),
  ]);
  const kanitlar = [...new Set(acik.flatMap(u => u.kanit || []))];
  const ks = kanitlar.filter(k => !k.startsWith("t:")), kt = kanitlar.filter(k => k.startsWith("t:")).map(k => k.slice(2));
  const K = Object.fromEntries([
    ...(ks.length ? (await q(sb.from("d_sikayet").select("*").in("key", ks))).map(s => [s.key, s]) : []),
    ...(kt.length ? (await q(sb.from("d_takip").select("*").in("key", kt))).map(s => ["t:" + s.key, takipKayit(s)]) : [])]);
  const kart = u => `<section class="kart" data-id="${u.id}">
    <div class="kart-ust"><b>${e(u.ad)}</b><span class="etiket ${u.kademe === "PASIF" ? "hata" : u.kademe === "G" ? "uyari" : ""}">${KADEME[u.kademe]}</span>
      <a class="soluk" href="#" onclick="event.preventDefault();git('ogretmen','${u.ogretmen_id}')">öğretmenin geçmişi</a>
      ${u.durum === "onaylandi" ? `<span class="etiket ok">Onaylandı (${e(u.karar_veren)}), 20 dakika içinde gidecek</span>` : ""}</div>
    ${u.kademe === "PASIF" ? '<p class="bilgi"><span>Onaylarsan:</span> öğretmene bu bildirim gider ve hesabı pasife alınır.</p>' : ""}
    <label>Başlık<input class="u-baslik" value="${e(u.title)}" ${u.durum !== "taslak" ? "disabled" : ""}></label>
    <label>Metin<textarea class="u-metin" rows="3" ${u.durum !== "taslak" ? "disabled" : ""}>${e(u.description)}</textarea></label>
    ${(u.kanit || []).length ? `<details><summary>Kanıt: ${u.kanit.length} cevap</summary>${u.kanit.map(k => K[k] ? sikayetKart(K[k], "goster") : "").join("")}</details>` : ""}
    <div class="kart-alt">${u.durum === "taslak" ? (u.kademe === "PASIF" && ben.rol !== "yonetici" ? '<span class="soluk">Hesap pasife alma onayını yalnızca yöneticiler verebilir.</span>' : `<button class="ince u-iptal">Gönderme</button><button class="birincil kucuk u-onay">${u.kademe === "PASIF" ? "Onayla ve pasife al" : "Onayla ve gönder"}</button>`) : `<button class="ince u-geri">Onayı geri al</button>`}</div></section>`;
  const DUR = { gonderildi: ["Gönderildi", "ok"], iptal: ["Gönderilmedi", ""], hata: ["Hata", "hata"] };
  $("#icerik").innerHTML = baslik("Uyarılar", "Şikayet sayılarına göre öğretmenlere gidecek bildirimler burada onayını bekler. Metni istersen düzelt, sonra \"Onayla ve gönder\" ya da \"Gönderme\" de. Onayladıkların en geç 20 dakika içinde gider. Aşağıda daha önce gönderilen bildirimlerin tamamı var.") + `
    <div id="u-acik">${acik.length ? acik.map(kart).join("") : '<div class="bos">Onay bekleyen uyarı yok. 👍</div>'}</div>
    <h2>Gönderilen bildirimler</h2>
    <div class="cipler" id="u-dur"><span class="cip-bas">Durum</span>${[["", "Hepsi"], ["gonderildi", "Gönderildi"], ["iptal", "Gönderilmedi"], ["hata", "Hata"]].map(([v, a]) => `<button class="cip ${v ? "" : "secili"}" data-v="${v}">${a} <small>${v ? gecmis.filter(u => u.durum === v).length : gecmis.length}</small></button>`).join("")}</div>
    <div class="cipler" id="u-tur"><span class="cip-bas">Tür</span>${[["", "Hepsi"], ...Object.entries(KADEME)].map(([v, a]) => `<button class="cip ${v ? "" : "secili"}" data-v="${v}">${a} <small>${v ? gecmis.filter(u => u.kademe === v).length : gecmis.length}</small></button>`).join("")}</div>
    <div class="filtre"><input id="u-ara" placeholder="Öğretmen adıyla ara"></div>
    <div class="tablo-sar"><table class="tablo sik" id="u-tablo"></table></div>`;
  let fd = "", ft = "";
  const ciz = () => {
    const a = $("#u-ara").value.toLocaleLowerCase("tr");
    const S = gecmis.filter(u => (!fd || u.durum === fd) && (!ft || u.kademe === ft) && (!a || u.ad.toLocaleLowerCase("tr").includes(a)));
    $("#u-tablo").innerHTML = `<tr><th>Tarih</th><th>Öğretmen</th><th>Tür</th><th>Durum</th><th>Metin</th></tr>` + (S.map(u => `<tr><td>${tarih(u.gonderim || u.karar_zamani || u.olusturma)}</td>
      <td><a href="#" onclick="event.preventDefault();git('ogretmen','${u.ogretmen_id}')">${e(u.ad)}</a></td><td>${KADEME[u.kademe] || e(u.kademe)}</td>
      <td>${u.kademe === "AKTIF" ? `<span class="etiket" data-ipucu="${e(u.sonuc || "Hesap yeniden açıldı, bildirim gönderilmedi.")}">Bildirim yok</span>` : `<span class="etiket ${DUR[u.durum][1]}" ${u.sonuc ? `data-ipucu="${e(u.sonuc)}"` : ""}>${DUR[u.durum][0]}</span>`}</td>
      <td>${u.kademe === "AKTIF" ? '<span class="soluk">Hesap yeniden açıldı</span>' : `<div class="tek-satir" data-uid="${u.id}" title="Tam metni görmek için tıkla"><b>${e(u.title)}</b> · ${e(u.description)}</div>`}</td></tr>`).join("") || '<tr><td colspan="5" class="soluk">Kayıt yok.</td></tr>');
    $("#u-tablo").querySelectorAll(".tek-satir").forEach(d => d.onclick = () => { const u = gecmis.find(x => x.id === +d.dataset.uid); metinGoster(u.title, u.description); });
  };
  const cip = (id, set) => $(id).querySelectorAll(".cip").forEach(c => c.onclick = () => { $(id).querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); set(c.dataset.v); ciz(); });
  cip("#u-dur", v => fd = v); cip("#u-tur", v => ft = v); $("#u-ara").oninput = ciz; ciz();
  document.querySelectorAll("section.kart[data-id]").forEach(k => {
    const id = +k.dataset.id;
    const karar = async onay => {
      if (onay && k.querySelector(".u-baslik:not([disabled])")) {
        const { error } = await sb.rpc("d_uyari_metin", { p_id: id, p_title: k.querySelector(".u-baslik").value, p_description: k.querySelector(".u-metin").value });
        if (error) return bildir("Metin kaydedilemedi: " + error.message);
      }
      const { error } = await sb.rpc("d_uyari_karar", { p_id: id, p_onay: onay });
      if (error) return bildir(error.message === "sadece_yonetici" ? "Bunu yalnızca yöneticiler onaylayabilir." : "Olmadı: " + error.message);
      toast(onay ? "Onaylandı" : "Gönderilmeyecek", onay ? "En geç 20 dakika içinde gönderilecek." : ""); rozetler(); uyari();
    };
    k.querySelector(".u-onay")?.addEventListener("click", () => { if (k.querySelector(".etiket.hata") && !confirm("Bildirim gidecek ve öğretmenin hesabı pasife alınacak. Emin misin?")) return; karar(true); });
    k.querySelector(".u-iptal")?.addEventListener("click", () => karar(false));
    k.querySelector(".u-geri")?.addEventListener("click", async () => {
      const { error } = await sb.rpc("d_uyari_karar", { p_id: id, p_onay: false });
      if (error) return bildir("Geri alınamadı (gönderilmiş olabilir)."); bildir("Onay geri alındı."); uyari();
    });
  });
}
function metinGoster(b, m) {
  let d = $("#metin-dlg"); if (!d) { d = document.createElement("dialog"); d.id = "metin-dlg"; d.className = "metin-dlg"; document.body.appendChild(d); d.onclick = ev => { if (ev.target === d) d.close(); }; }
  d.innerHTML = `<h3>${e(b)}</h3><p>${e(m)}</p><div class="dlg-alt"><button class="ince" onclick="this.closest('dialog').close()">Kapat</button></div>`; d.showModal();
}

// ---------- öğretmenler ----------
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
  const [O, U, S7] = await Promise.all([q(sb.from("d_ogretmen").select("*").limit(2000)), q(sb.from("d_uyari").select("ogretmen_id,kademe,durum,gonderim,olusturma,title").order("id")), tumSikayetler(7)]);
  const son = {}, bekleyenU = {}, H = {};
  for (const u of U) { if (u.durum === "gonderildi" || u.kademe === "AKTIF") son[u.ogretmen_id] = u; if (u.durum === "taslak" || u.durum === "onaylandi") bekleyenU[u.ogretmen_id] = u; }
  for (const s of S7) {
    if (s.tur !== "c" || !s.ogretmen_id || s.durum !== "islendi") continue;
    const h = H[s.ogretmen_id] ||= { onay: 0, top: 0, kat: {} }; h.top++;
    if (s.son_karar === "ONAYLA") { h.onay++; for (const k of kategori(s.gerekce)) h.kat[k] = (h.kat[k] || 0) + 1; }
  }
  const yeniBildirim = o => son[o.id] && Date.now() - new Date(son[o.id].gonderim || son[o.id].olusturma) < 7 * 864e5;
  const esik = o => { const h = H[o.id]; if (!h || o.durum === "pasif") return null;  // UYARI_KURALLAR.md eşikleri (son 7 gün)
    if (h.onay >= 4 && h.onay / h.top >= .5) return "G"; if (h.kat.yapay_zeka) return "Y"; if ((h.kat.dijital_metin || 0) >= 2 || (h.kat.soru_ustune || 0) >= 2) return "F"; return null; };
  const takipGerekli = o => esik(o) && !yeniBildirim(o) && !bekleyenU[o.id];
  const takipDurum = o => {
    const b = bekleyenU[o.id], u = son[o.id];
    if (b) return `<span class="etiket uyari">${KADEME[b.kademe]} onay bekliyor</span>`;
    if (takipGerekli(o)) return `<span class="etiket hata" data-ipucu="Son 7 günde uyarı eşiğini aştı ama bildirim gitmedi.">Takip gerekli</span>`;
    if (u) return `<span class="etiket ok" data-ipucu="${e(tarih(u.gonderim || u.olusturma))}">${KADEME[u.kademe]}</span>`;
    return '<span class="soluk">—</span>';
  };
  const F = { "": ["Hepsi", () => true], takip: ["Takip gerekli", takipGerekli], bildirim: ["Bildirim gitti", o => !!son[o.id]], aktif: ["Aktif", o => o.durum !== "pasif"], pasif: ["Pasif", o => o.durum === "pasif"] };
  $("#icerik").innerHTML = baslik("Öğretmenler", "Cevaplarına şikayet gelen öğretmenler. Onay: şikayette öğrenci haklı bulundu. \"Takip gerekli\": son 7 günde uyarı eşiğini aştı ama henüz bildirim gitmedi. Bir satıra tıklayınca öğretmenin bütün şikayetleri ve aldığı bildirimler açılır.") + `
    <div class="cipler" id="o-cip">${Object.entries(F).map(([v, [a, f]]) => `<button class="cip ${v ? "" : "secili"}" data-v="${v}">${a} <small>${O.filter(f).length}</small></button>`).join("")}</div>
    <div class="filtre"><input id="o-ara" placeholder="İsimle ara"><select id="o-sira"><option value="h">Son 7 gündeki onaya göre sırala</option><option value="t">Toplam onaya göre sırala</option></select></div>
    <div class="tablo-sar"><table class="tablo sik" id="o-tablo"></table></div>`;
  let fv = "";
  const ciz = () => {
    const a = $("#o-ara").value.toLocaleLowerCase("tr");
    const S = O.filter(o => F[fv][1](o) && (!a || o.ad.toLocaleLowerCase("tr").includes(a)))
      .sort($("#o-sira").value === "h" ? (x, y) => (H[y.id]?.onay || 0) - (H[x.id]?.onay || 0) || y.onay - x.onay : (x, y) => y.onay - x.onay);
    $("#o-tablo").innerHTML = `<tr><th>Öğretmen</th><th>Durum</th><th>Son 7 gün onay</th><th>Toplam onay / ret</th><th>Onaylanan şikayetlerin sebebi</th><th>Takip / bildirim</th></tr>` +
      (S.map(o => `<tr class="tik" data-id="${o.id}"><td>${e(o.ad)}</td><td><span class="etiket ${o.durum === "pasif" ? "hata" : "ok"}">${o.durum === "pasif" ? "Pasif" : "Aktif"}</span></td>
        <td>${H[o.id] ? `<b>${H[o.id].onay}</b> / ${H[o.id].top}` : '<span class="soluk">—</span>'}</td><td>${o.onay} / ${o.ret}</td>
        <td class="soluk">${Object.entries(o.kategoriler || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${KAT[k] || k} ${v}`).join(", ")}</td><td>${takipDurum(o)}</td></tr>`).join("") || '<tr><td colspan="6" class="soluk">Kayıt yok.</td></tr>');
    $("#o-tablo").querySelectorAll("tr.tik").forEach(r => r.onclick = () => git("ogretmen", r.dataset.id));
  };
  $("#o-cip").querySelectorAll(".cip").forEach(c => c.onclick = () => { $("#o-cip").querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); fv = c.dataset.v; ciz(); });
  $("#o-ara").oninput = ciz; $("#o-sira").onchange = ciz; ciz();
}
async function ogretmenDetay(id) {
  const [o, S, U, T, P] = await Promise.all([
    q(sb.from("d_ogretmen").select("*").eq("id", id).maybeSingle()),
    q(sb.from("d_sikayet").select("*").eq("ogretmen_id", id).eq("tur", "c").order("olusturma", { ascending: false }).limit(200)),
    q(sb.from("d_uyari").select("*").eq("ogretmen_id", id).order("id", { ascending: false })),
    q(sb.from("d_takip").select("*").eq("ogretmen_id", id).order("cevap_tarihi", { ascending: false })),
    q(sb.from("d_solver_puan").select("*").eq("id", id).maybeSingle()),
  ]);
  const seo = S.find(s => s.ogretmen_seo)?.ogretmen_seo || P?.seo;
  // tek akış: şikayet, bildirim, pasif/aktif, yakın takip, eksi puan
  const A = [];
  S.forEach(s => A.push({ z: s.olusturma, tur: "sikayet", renk: sonucRenk(s.son_karar), b: s.durum === "bekliyor" ? "Şikayet · karar bekliyor" : "Şikayet · " + sonucAdi("c", s.son_karar), m: `${s.ders || ""} — ${s.gerekce || ""}`, key: s.key }));
  U.filter(u => u.durum !== "taslak").forEach(u => A.push({ z: u.gonderim || u.karar_zamani || u.olusturma, tur: "uyari", renk: u.kademe === "PASIF" ? "hata" : u.kademe === "AKTIF" ? "ok" : "uyari",
    b: (KADEME[u.kademe] || u.kademe) + (u.durum === "gonderildi" ? " · bildirim gitti" : u.kademe === "AKTIF" ? "" : " · gönderilmedi"), m: u.kademe === "AKTIF" ? (u.description || "") : u.description }));
  T.forEach(x => A.push({ z: x.cevap_tarihi, tur: "takip", renk: sonucRenk(x.sonuc), b: "Yakın takip · " + sonucAdi("c", x.sonuc), m: `${x.ders || ""} — ${x.gerekce || ""}` }));
  if (P?.eksiye_dustu) A.push({ z: P.eksiye_dustu, tur: "eksi", renk: "hata", b: "Puan eksiye düştü", m: `Puan ${P.puan}` });
  A.sort((a, b) => (b.z || "").localeCompare(a.z || ""));
  const IK = { sikayet: "message-square-warning", uyari: "bell", takip: "eye", eksi: "trending-down" };
  $("#icerik").innerHTML = `<button class="geri" onclick="git('ogretmen')">← Öğretmenler</button>
    <div class="ust-cubuk"><div><h2>${e(o?.ad || P?.ad || "Öğretmen " + id)} ${o ? `<span class="etiket ${o.durum === "pasif" ? "hata" : "ok"}">${o.durum === "pasif" ? "Pasif" : "Aktif"}</span>` : ""}</h2>
    <p class="aciklama">${o ? `${o.onay} şikayette öğrenci, ${o.ret} şikayette öğretmen haklı bulundu.` : ""}${P ? ` Güncel puan: <b>${P.puan}</b>.` : ""} ${seo ? `<a href="${ADMIN}/User/Detail/${e(seo)}" target="_blank" rel="noopener">Admin panelde profili aç</a>` : ""}</p></div></div>
    <div class="cipler" id="z-cip">${[["", "Hepsi"], ["sikayet", "Şikayetler"], ["uyari", "Bildirimler"], ["takip", "Yakın takip"], ["eksi", "Puan"]].map(([v, a]) => `<button class="cip ${v ? "" : "secili"}" data-v="${v}">${a} <small>${v ? A.filter(x => x.tur === v).length : A.length}</small></button>`).join("")}</div>
    <div class="kart zaman" id="z-akis"></div>`;
  const ciz = v => {
    $("#z-akis").innerHTML = A.filter(x => !v || x.tur === v).map((x, i) => `<div class="z-satir" ${x.key ? `data-key="${e(x.key)}"` : ""}>
      <div class="z-ikon ${x.renk}"><i data-lucide="${IK[x.tur]}"></i></div>
      <div class="z-govde"><div class="z-bas"><b>${e(x.b)}</b><span class="soluk">${tarih(x.z)}</span></div><div class="klamp">${e(x.m)}</div>
      ${x.key ? `<button class="devam z-ac">Görselleri ve detayı aç</button><div class="z-detay" hidden></div>` : ""}</div></div>`).join("") || '<p class="soluk">Kayıt yok.</p>';
    ikon(); klampBagla($("#z-akis"));
    $("#z-akis").querySelectorAll(".z-ac").forEach(b => b.onclick = () => {
      const kutu = b.nextElementSibling, s = S.find(x => x.key === b.closest(".z-satir").dataset.key);
      kutu.hidden = !kutu.hidden; b.textContent = kutu.hidden ? "Görselleri ve detayı aç" : "Kapat";
      if (!kutu.innerHTML) { kutu.innerHTML = sikayetKart(s, "goster"); klampBagla(kutu); }
    });
  };
  $("#z-cip").querySelectorAll(".cip").forEach(c => c.onclick = () => { $("#z-cip").querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); ciz(c.dataset.v); });
  ciz("");
}

// ---------- tüm şikayetler ----------
async function sikayet() {
  $("#icerik").innerHTML = baslik("Tüm şikayetler", "İncelenmiş bütün şikayetlerin listesi. Satıra tıklayınca aynı satırda soru, cevap ve kararın gerekçesi açılır. Öğrenci ve öğretmen adları admin paneldeki profillerine gider. Görseller sadece satırı açınca yüklenir.") + `
    <div class="cipler" id="f-tur"><span class="cip-bas">Tür</span><button class="cip secili" data-v="">Hepsi</button><button class="cip" data-v="s">Soru şikayeti</button><button class="cip" data-v="c">Cevap şikayeti</button></div>
    <div class="cipler" id="f-karar"><span class="cip-bas">Sonuç</span><button class="cip secili" data-v="">Hepsi</button><button class="cip" data-v="ONAYLA">Onaylandı</button><button class="cip" data-v="REDDET">Reddedildi</button><button class="cip" data-v="HAVUZA_AKTAR">Derse aktarıldı</button><button class="cip" data-v="bekliyor">Karar bekliyor</button></div>
    <div class="filtre"><input id="f-ara" placeholder="Şikayet no, ders, öğrenci ya da öğretmen adı"></div><div id="f-liste"></div>`;
  let ft = "", fk = "";
  const yukle = async () => {
    let p = sb.from("d_sikayet").select("*").order("olusturma", { ascending: false }).limit(200);
    if (ft) p = p.eq("tur", ft);
    if (fk === "bekliyor") p = p.eq("durum", "bekliyor"); else if (fk) p = p.eq("son_karar", fk);
    const a = $("#f-ara").value.trim().replace(/[,()]/g, " ");
    if (/^\d+$/.test(a)) p = p.eq("sikayet_id", +a); else if (a) p = p.or(`ders.ilike.%${a}%,ogretmen.ilike.%${a}%,ogrenci.ilike.%${a}%`);
    const L = await q(p);
    $("#f-liste").innerHTML = `<div class="tablo-sar"><table class="tablo sik"><tr><th></th><th>Tarih</th><th>Tür</th><th>Ders</th><th>Öğrenci</th><th>Öğretmen</th><th>Sonuç</th></tr>
      ${L.map(s => `<tr class="tik" data-key="${e(s.key)}"><td><span class="ok-ikon">›</span></td><td class="nw">${tarih(s.olusturma)}</td><td class="nw">${s.tur === "s" ? "Soru" : "Cevap"} <span class="soluk">#${s.sikayet_id}</span></td><td>${e(s.ders)}</td>
        <td>${kisiLink(s.ogrenci_seo, s.ogrenci)}</td><td>${kisiLink(s.ogretmen_seo, s.ogretmen)}</td>
        <td>${s.durum === "bekliyor" ? '<span class="etiket uyari">Karar bekliyor</span>' : `<span class="etiket ${sonucRenk(s.son_karar)}">${sonucAdi(s.tur, s.son_karar)}</span>`}</td></tr>
        <tr class="acilir" hidden><td colspan="7"></td></tr>`).join("") || '<tr><td colspan="7" class="soluk">Kayıt yok.</td></tr>'}</table></div>`;
    $("#f-liste").querySelectorAll("tr.tik").forEach(t => t.onclick = ev => { if (ev.target.closest("a")) return;
      const alt = t.nextElementSibling; alt.hidden = !alt.hidden; t.classList.toggle("acik-satir", !alt.hidden);
      if (!alt.hidden && !alt.firstElementChild.innerHTML) { alt.firstElementChild.innerHTML = sikayetKart(L.find(s => s.key === t.dataset.key), "goster"); klampBagla(alt); }
    });
  };
  const cip = (id, set) => $(id).querySelectorAll(".cip").forEach(c => c.onclick = () => { $(id).querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); set(c.dataset.v); yukle(); });
  cip("#f-tur", v => ft = v); cip("#f-karar", v => fk = v);
  let z; $("#f-ara").oninput = () => { clearTimeout(z); z = setTimeout(yukle, 350); }; await yukle();
}

// ---------- solver başvuruları ----------
function basvuruKart(b, kontrol) {
  const hepsi = (b.sorular || []).flatMap(s => [...(s.soru_url || []).slice(0, 1), ...(s.cevap_url || []).slice(0, 1)]);
  let i = 0;
  const grid = (b.sorular || []).map(s => {
    const si = i; i += (s.soru_url || []).slice(0, 1).length; const ci = i; i += (s.cevap_url || []).slice(0, 1).length;
    return `<div class="b-kutu"><div class="ciftm">${s.soru_url?.[0] ? `<div data-galeri="${si}"><img src="${e(s.soru_url[0])}" loading="lazy" alt=""></div>` : "<div></div>"}${s.cevap_url?.[0] ? `<div data-galeri="${ci}"><img src="${e(s.cevap_url[0])}" loading="lazy" alt=""></div>` : "<div></div>"}</div>
      <div class="b-alt"><span><b>${s.no}.</b> <span class="soluk">Doğru ${e(s.dogru_cevap || "?").slice(0, 14)} · aday ${e(s.aday_cevap || "?").slice(0, 8)}</span></span>
      <span class="etiket ${s.dogru_mu === false ? "hata" : s.format_uygun === false ? "uyari" : "ok"}" ${s.not ? `data-ipucu="${e(s.not)}"` : ""}>${s.dogru_mu === false ? "Yanlış" : s.format_uygun === false ? "Format" : "Doğru"}</span></div></div>`;
  }).join("");
  const alt = kontrol ? `<div class="aksiyon"><button class="secim onay" data-v="DOGRU">Karar doğru</button><button class="secim ret" data-v="YANLIS">Karar yanlış</button><input placeholder="Yanlışsa neden? (zorunlu)"><button class="birincil kucuk b-kaydet">Kaydet</button></div>` : "";
  return `<section class="kart sk" data-bid="${b.id}"><div class="sk-ust"><span class="etiket">Solver başvurusu</span><b>${e(b.ad)}</b><span class="soluk">${e(b.ders)} · ${e(b.basvuru_tarihi)}</span>
    <span class="sag"><a class="soluk" target="_blank" rel="noopener" href="${ADMIN}/SolverApplication/SolverApplicationDetail/${b.id}">admin panelde aç</a>
    <span class="etiket ${b.karar === "ONAYLA" ? "ok" : "hata"}">${b.karar === "ONAYLA" ? "Onaylandı" : "Reddedildi"}</span></span></div>
    <div class="sk-karar"><div class="sk-karar-satir">${b.karar === "ONAYLA" ? '<span class="etiket ok">6/6 doğru, format uygun</span>' : `<span class="etiket hata">${e(b.sebep)}</span>`}</div><div class="klamp">${e(b.gerekce)}</div></div>
    <div class="b-grid" data-medya='${e(JSON.stringify(hepsi))}'>${grid}</div>${alt}</section>`;
}
function basvuruBagla(yenile) {
  document.querySelectorAll("section[data-bid]").forEach(k => {
    let sec = null;
    k.querySelectorAll(".secim").forEach(x => x.onclick = () => { sec = x.dataset.v; k.querySelectorAll(".secim").forEach(y => y.classList.toggle("secili", y === x)); });
    const btn = k.querySelector(".b-kaydet"); if (!btn) return;
    btn.onclick = async () => {
      const not = k.querySelector(".aksiyon input").value.trim(), id = +k.dataset.bid;
      if (!sec) return bildir("Önce seçim yap."); if (sec === "YANLIS" && not.length < 3) return bildir("Yanlış dediysen nedenini yaz.");
      const { error } = await sb.rpc("d_basvuru_kontrol", { p_id: id, p_secim: sec, p_not: not });
      if (error) return bildir("Kaydedilemedi: " + error.message);
      k.classList.add("gidiyor"); setTimeout(() => k.remove(), 250); rozetler();
      toast("Kontrol kaydedildi", "", async () => {
        const r = await sb.rpc("d_basvuru_kontrol_geri_al", { p_id: id });
        if (r.error) return bildir("Geri alınamadı."); bildir("Geri alındı."); rozetler(); yenile && yenile();
      });
    };
  });
}
async function basvuru() {
  const L = await q(sb.from("d_basvuru").select("*").order("islem_zamani", { ascending: false }).limit(300));
  const seb = {}; L.filter(b => b.karar !== "ONAYLA").forEach(b => seb[b.sebep] = (seb[b.sebep] || 0) + 1);
  $("#icerik").innerHTML = baslik("Solver başvuruları", "Solver olmak isteyen adaylar 6 test sorusu çözer. 6 sorunun hepsi doğru ve çözümler Solver Kılavuzu'ndaki formata uygunsa aday solver olarak onaylanır, değilse reddedilir. Kararlar otomatik verilir, adaya ayrıca bildirim gitmez. Küçük görsellere tıklayınca büyür; çiplerin üstüne gelince not görünür.") + `
    <div class="cipler" id="b-cip"><button class="cip secili" data-v="">Hepsi <small>${L.length}</small></button><button class="cip" data-v="ONAYLA">Onaylanan <small>${L.filter(b => b.karar === "ONAYLA").length}</small></button>
      ${Object.entries(seb).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<button class="cip" data-v="${e(k)}">${e(k)} <small>${v}</small></button>`).join("")}</div>
    <div class="filtre"><input id="b-ara" placeholder="İsim ya da ders"></div><div id="b-liste"></div>`;
  let fv = "";
  const ciz = () => { const a = $("#b-ara").value.toLocaleLowerCase("tr");
    $("#b-liste").innerHTML = L.filter(b => (!fv || (fv === "ONAYLA" ? b.karar === "ONAYLA" : b.sebep === fv)) && (!a || (b.ad + " " + b.ders).toLocaleLowerCase("tr").includes(a))).map(b => basvuruKart(b, false)).join("") || '<div class="bos">Kayıt yok.</div>';
    klampBagla($("#b-liste")); };
  $("#b-cip").querySelectorAll(".cip").forEach(c => c.onclick = () => { $("#b-cip").querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); fv = c.dataset.v; ciz(); });
  $("#b-ara").oninput = ciz; ciz();
}

// ---------- yakın takip ----------
function takipKayit(t) {
  return { key: "t:" + t.key, tur: "c", sikayet_id: t.question_id, question_id: t.question_id, ders: t.ders, ogretmen: t.ogretmen, ogretmen_id: t.ogretmen_id, olusturma: t.cevap_tarihi,
    soru_url: t.soru_url, cevap_url: t.cevap_url, video_url: t.video_url, ajan_karar: t.sonuc, gerekce: t.gerekce, durum: "islendi", son_karar: t.sonuc };
}
async function takip() {
  const [I, T] = await Promise.all([q(sb.from("d_izlenen").select("*").order("baslangic")), q(sb.from("d_takip").select("*").order("cevap_tarihi", { ascending: false }).limit(500))]);
  const S = {}; T.forEach(t => { const s = S[t.ogretmen_id] ||= { TEMIZ: 0, SORUNLU: 0, YZ_KESIN: 0 }; s[t.sonuc]++; });
  $("#icerik").innerHTML = baslik("Yakın takip", "Yapay zekâ kullandığı için hesabı kapatılıp sonra yeniden açılan öğretmenler 14 gün boyunca yakından izlenir: şikayet gelmese bile verdikleri her cevap 3 saatte bir kontrol edilir. Yapay zekâ kesin görülürse hesabı kapatma önerisi Uyarılar'a düşer.") + `
    <div class="tablo-sar"><table class="tablo sik"><tr><th>Öğretmen</th><th>Takip süresi</th><th>Kontrol edilen cevap</th><th>Temiz</th><th>Sorunlu</th><th>Yapay zekâ</th></tr>
    ${I.map(o => { const s = S[o.ogretmen_id] || { TEMIZ: 0, SORUNLU: 0, YZ_KESIN: 0 }; return `<tr class="tik" onclick="git('ogretmen','${o.ogretmen_id}')"><td>${e(o.ad)}</td><td class="soluk">${tarih(o.baslangic)} → ${tarih(o.bitis)}</td><td>${s.TEMIZ + s.SORUNLU + s.YZ_KESIN}</td><td>${s.TEMIZ}</td><td>${s.SORUNLU}</td><td><b>${s.YZ_KESIN}</b></td></tr>`; }).join("")}</table></div>
    <h2>Sorunlu bulunan cevaplar</h2>
    ${T.filter(t => t.sonuc !== "TEMIZ").map(t => sikayetKart(takipKayit(t), "goster")).join("") || '<div class="bos">Sorunlu cevap yok. 👍</div>'}`;
}

// ---------- eksi puanlı solverlar ----------
async function eksi() {
  const L = await q(sb.from("d_solver_puan").select("*").order("puan").limit(1000));
  const ek = L.filter(x => x.puan < 0), risk = L.filter(x => x.puan >= 0 && x.puan < 20), son = L.reduce((a, x) => x.son_okuma > a ? x.son_okuma : a, "");
  const satir = x => `<tr><td>${kisiLink(x.seo, x.ad)}</td><td><b>${Number(x.puan)}</b></td><td>${x.onceki_puan ?? "—"}</td><td>${x.son_3gun_cevap ?? ""}</td>
    <td>${x.eksiye_dustu ? tarih(x.eksiye_dustu) : '<span class="soluk">—</span>'}</td><td>${x.bildirim_zamani ? `<span class="etiket ok">Gitti · ${tarih(x.bildirim_zamani)}</span>` : '<span class="soluk">—</span>'}</td></tr>`;
  const bas = `<tr><th>Solver</th><th>Puan</th><th>Önceki okuma</th><th>Son 3 gün cevap</th><th>Eksiye düştü</th><th>Bildirim</th></tr>`;
  $("#icerik").innerHTML = baslik("Eksi puanlı solverlar", "Puanı eksideki solver çözdüğü sorudan ücret alamaz. Son 3 günde cevap veren solverların puanı saatte bir okunur. Puanı artıdan eksiye düşen solvera otomatik kısa bir bildirim gider. Özellikle yeni solverlar ilk günlerde kolay eksiye düşer; listede uzun süre kalan olursa Ulaş'a haber ver.") + `
    <div class="bilgi-serit"><i data-lucide="clock"></i>Son okuma: ${son ? tarih(son) : "—"} · ${L.length} aktif solver</div>
    <h2>Şu an eksi puanda (${ek.length})</h2><div class="tablo-sar" id="e-eksi"><table class="tablo sik">${bas}${ek.map(satir).join("") || '<tr><td colspan="6" class="soluk">Eksi puanlı solver yok. 👍</td></tr>'}</table></div>
    <h2>Risk grubu: puanı 0–19 arası (${risk.length})</h2><p class="aciklama">Bir onaylanan şikayet (−3 puan) ya da bir cezayla eksiye düşebilirler.</p>
    <div class="tablo-sar"><table class="tablo sik">${bas}${risk.map(satir).join("")}</table></div>`;
}

// ---------- öğrenciler ----------
async function ogrenci() {
  const L = (await tumSikayetler(30)).filter(s => s.tur === "c"), O = {};
  const seo = {}; (await q(sb.from("d_sikayet").select("ogrenci_id,ogrenci_seo").eq("tur", "c").not("ogrenci_seo", "is", null).limit(5000))).forEach(x => seo[x.ogrenci_id] = x.ogrenci_seo);
  for (const s of L) {
    if (!s.ogrenci_id) continue;
    const o = O[s.ogrenci_id] ||= { ad: s.ogrenci, n: 0, ret: 0, onay: 0, sorular: {} };
    o.n++; if (s.son_karar === "REDDET") o.ret++; else if (s.son_karar === "ONAYLA") o.onay++;
    o.sorular[s.question_id] = (o.sorular[s.question_id] || 0) + 1;
  }
  const R = Object.entries(O).map(([id, o]) => ({ id, ...o, tekrar: Object.values(o.sorular).filter(v => v > 1).length, oran: o.n ? o.ret / o.n : 0 }))
    .map(o => ({ ...o, supheli: (o.n >= 5 && o.oran >= .6) || (o.tekrar >= 1 && o.n >= 3) })).sort((a, b) => b.supheli - a.supheli || b.ret - a.ret || b.n - a.n);
  $("#icerik").innerHTML = baslik("Öğrenciler", "Son 30 günde cevaplara şikayet açan öğrenciler. Haksız: şikayet reddedildi, öğretmen haklıydı. Şüpheli: 5 ya da daha fazla şikayetinin %60'ından fazlası haksız çıkan ya da aynı soruya birden çok kez şikayet açan öğrenci. İsme tıklayınca admin paneldeki profili açılır.") + `
    <div class="cipler" id="og-cip"><button class="cip secili" data-v="s">Şüpheliler <small>${R.filter(o => o.supheli).length}</small></button><button class="cip" data-v="">Hepsi <small>${R.length}</small></button></div>
    <div class="tablo-sar"><table class="tablo sik" id="og-t"></table></div>`;
  let fv = "s";
  const ciz = () => {
    $("#og-t").innerHTML = `<tr><th>Öğrenci</th><th>Şikayet</th><th>Haksız</th><th>Haklı</th><th>Aynı soruya tekrar</th><th></th></tr>` +
      (R.filter(o => !fv || o.supheli).map(o => `<tr><td>${kisiLink(seo[o.id], o.ad)}</td><td><b>${o.n}</b></td><td>${o.ret} <span class="soluk">(%${Math.round(o.oran * 100)})</span></td><td>${o.onay}</td><td>${o.tekrar || ""}</td>
        <td>${o.supheli ? '<span class="etiket hata">Şüpheli</span>' : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="soluk">Kayıt yok.</td></tr>');
  };
  $("#og-cip").querySelectorAll(".cip").forEach(c => c.onclick = () => { $("#og-cip").querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); fv = c.dataset.v; ciz(); });
  ciz();
}

// ---------- kullanım rehberi (? düğmesi) ----------
const REHBER = {
  ozet: [["#oz-kontrol", "Son otomatik kontrol", "Şikayetler 20 dakikada bir otomatik incelenir. Bu süre 50 dakikayı geçerse kutu turuncu olur; Ulaş'a haber ver."],
    ["#oz-baglanti", "Admin paneli bağlantısı", "Kararların admin paneline işlenebilmesi için bağlantı gerekir. \"Kopuk\" görürsen kararlar bağlantı gelene kadar sırada bekler."],
    ["#oz-dogruluk", "Otomatik karar doğruluğu", "Haftalık kontrolde \"Karar doğru\" dediğin kararların oranı. %90'ın altına düşerse kutu turuncu olur; o zaman kuralları birlikte gözden geçiririz."],
    ["#oz-bekleyen", "Kararını bekleyen", "Otomatik incelemenin emin olamadığı ve senin kararını bekleyen şikayetler. Sol menüden Şikayetler › Kararını Bekleyenler'e git."],
    ["#oz-kontroller", "Son otomatik kontroller", "Her kontrolde kaç şikayet incelendi ve nasıl sonuçlandı. \"Neler oldu\"ya tıklayınca tek tek görürsün."]],
  gunluk: [["#gn-kutular", "30 günün toplamı", "Toplam şikayet ve bunların kaçının onaylandığı, reddedildiği, doğru derse aktarıldığı."], ["#gn-tablo", "Gün gün", "Her satır bir gün. Sağdaki çubuk o günün yoğunluğunu gösterir."]],
  bekleyen: [["section.sk .sk-kisiler", "Kimler", "Öğrenci ve öğretmen adına tıklayınca admin paneldeki profili açılır. \"Soruyu admin panelde aç\" sorunun sayfasına gider."],
    ["section.sk .sk-bilgi", "Öğrencinin şikayeti", "Öğrencinin neden şikayet ettiği ve yazdığı not. Kararı verirken önce buna bak."],
    ["section.sk .medya", "Soru ve cevap", "Solda soru, sağda öğretmenin cevabı. Görsele tıklayınca büyür, oklarla diğer görsellere geçersin."],
    ["section.sk .sk-karar", "Otomatik incelemenin görüşü", "İlk incelemenin önerisi ve gerekçesi. \"Emin değil\" yazıyorsa karar senin. \"İkinci kontrol\" varsa kayda ikinci kez bakılmıştır."],
    ["section.sk .aksiyon", "Kararın", "Cevap şikayetinde Onayla = öğrenci haklı (öğretmen ücret alamaz), Reddet = öğretmen haklı. Soru şikayetinde Onayla = soru kaldırılır. İstersen not yaz, Kaydet'e bas. 15 saniye içinde sağ alttan geri alabilirsin."]],
  kontrol: [[".bilgi-serit", "Bu haftanın ilerlemesi", "Kaç kararı kontrol ettiğin."], ["section.sk .sk-karar", "Verilen karar", "Otomatik incelemenin verdiği karar ve gerekçesi. Görsellere bakıp katılıp katılmadığına karar ver."],
    ["section.sk .aksiyon", "Doğru mu?", "Katılıyorsan \"Karar doğru\". Katılmıyorsan \"Karar yanlış\" seç ve nedenini yaz; bu not kurallara eklenir. Yanlış kararı admin panelinde ayrıca elle düzeltmen gerekir."]],
  uyari: [["#u-acik", "Onay bekleyen bildirimler", "Kurallara göre hazırlanmış bildirimler. Metni düzeltebilirsin. \"Onayla ve gönder\" 20 dakika içinde gönderir, \"Gönderme\" iptal eder. \"Hesabı pasife alma\" onaylanırsa öğretmenin hesabı kapanır."],
    ["#u-dur", "Hızlı filtre", "Gönderilen bildirimleri duruma ve türe göre süz."], ["#u-tablo", "Geçmiş", "Metnin tamamını görmek için metne tıkla. Durum çipinin üstüne gelince varsa açıklaması görünür."]],
  ogretmen: [["#o-cip", "Hızlı filtre", "\"Takip gerekli\": uyarı eşiğini aşmış ama bildirim almamış öğretmenler; önce bunlara bak."], ["#o-tablo", "Liste", "Bir satıra tıklayınca öğretmenin bütün şikayetleri ve aldığı bildirimler açılır."]],
  sikayet: [["#f-tur", "Filtreler", "Türe ve sonuca göre süz, altta ada ya da şikayet numarasına göre ara."], ["#f-liste", "Liste", "Satıra tıklayınca aynı satırda detay açılır. Öğrenci/öğretmen adları admin paneldeki profile gider."]],
  basvuru: [["#b-cip", "Filtreler", "Onaylananlar ya da ret sebebine göre süz."], ["section.sk .b-grid", "6 test sorusu", "Her kutuda solda soru, sağda adayın çözümü. Tıklayınca büyür. Çipin üstüne gelince not görünür."]],
  takip: [[".tablo-sar", "İzlenen öğretmenler", "Kaç cevabının kontrol edildiği ve sonuçları. Satıra tıklayınca öğretmenin sayfası açılır."]],
  eksi: [["#e-eksi", "Eksidekiler", "Bu solverlar şu an soru başına ücret alamıyor. Bildirim sütunu, eksiye düştüğünde otomatik bildirimin gidip gitmediğini gösterir."]],
  ogrenci: [["#og-cip", "Şüpheliler", "Sık ve çoğunlukla haksız şikayet açan öğrenciler."], ["#og-t", "Liste", "İsme tıklayınca admin paneldeki profil açılır."]],
};
let rAd = 0, rL = [];
function rehberBaslat() {
  const bas = document.querySelector(".ust-cubuk");
  rL = [...(bas ? [[".ust-cubuk", "Bu sayfa ne işe yarar?", bas.querySelector(".aciklama").textContent]] : []), ...(REHBER[sekme] || []).filter(([s]) => document.querySelector(s))];
  if (!rL.length) return bildir("Bu sayfada gösterilecek bir şey yok.");
  if (!$("#rehber-perde")) document.body.insertAdjacentHTML("beforeend", '<div id="rehber-perde"></div><div id="rehber-isik"></div><div id="rehber-kutu"></div>');
  $("#rehber-perde").onclick = rehberKapat; rAd = 0; rehberCiz();
}
function rehberCiz() {
  const [sel, b, m] = rL[rAd], el = document.querySelector(sel);
  el.scrollIntoView({ block: "center", behavior: "instant" });
  const r = el.getBoundingClientRect(), p = 6, isik = $("#rehber-isik"), kutu = $("#rehber-kutu");
  const h = Math.min(r.height, window.innerHeight - 40);
  Object.assign(isik.style, { left: r.left - p + "px", top: r.top - p + "px", width: r.width + 2 * p + "px", height: h + 2 * p + "px", display: "block" });
  kutu.innerHTML = `<h4>${b}</h4><p>${m}</p><div class="r-alt"><span>${rAd + 1} / ${rL.length}</span><span style="display:flex;gap:6px">
    <button class="ince" onclick="rehberKapat()">Kapat</button>${rAd ? '<button class="ince" onclick="rAd--;rehberCiz()">Geri</button>' : ""}
    ${rAd < rL.length - 1 ? '<button class="birincil kucuk" onclick="rAd++;rehberCiz()">İleri</button>' : '<button class="birincil kucuk" onclick="rehberKapat()">Bitti</button>'}</span></div>`;
  const kw = Math.min(320, window.innerWidth - 32), altBos = window.innerHeight - (r.top + h + p) > 200;
  Object.assign(kutu.style, { display: "block", left: Math.max(16, Math.min(r.left, window.innerWidth - kw - 16)) + "px", top: (altBos ? r.top + h + p + 10 : Math.max(16, r.top - p - 10 - kutu.offsetHeight)) + "px" });
}
function rehberKapat() { ["#rehber-perde", "#rehber-isik", "#rehber-kutu"].forEach(s => $(s)?.remove()); }
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && $("#rehber-kutu")) rehberKapat(); });

window.git = git; window.rehberBaslat = rehberBaslat; window.rehberKapat = rehberKapat; window.rehberCiz = rehberCiz;
sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") girisGoster(); });
basla();
