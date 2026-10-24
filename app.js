// Tahta Destek Paneli. Veri Supabase'de (d_ tabloları), yazma sadece RPC'lerle.
// Panel admin.tahtaapp.com'a bağlanmaz: kararlar kaydedilir, Mac (hizli.sh, dakikada bir) geri al süresi dolunca admin paneline işler.
// Görseller Tahta'nın kendi CDN'inden (cloudfront) doğrudan, sadece görünür olunca yüklenir; bu panel görsel depolamaz.
const SB_URL = "https://rbjrnevngfuribasrnph.supabase.co";
const SB_ANON = "sb_publishable_yK1dNA6CGKIQ88U3gp53xA_nBLQGNVJ";
const sb = window.supabase.createClient(SB_URL, SB_ANON);
// Cevap gönderici bot hesabı (914867, "Test Hesabı") panele düşmesin: bu hesabın
// şikayet/uyarı/başvuru/kesinti/öğretmen kayıtları gerçek öğretmen değil, botun
// soru bankası cevaplarına gelen değerlendirmeler. Tek noktadan tüm okumalardan dışlanır.
const BOT_ID = 914867;
const BOT_GIZLI = { d_sikayet: "ogretmen_id", d_uyari: "ogretmen_id", d_basvuru: "user_id", d_kesinti: "ogretmen_id", d_kesinti_cevap: "ogretmen_id", d_takip: "ogretmen_id", d_ogretmen: "id", d_solver_puan: "id" };
{
  const _from = sb.from.bind(sb);
  sb.from = (t) => {
    const b = _from(t), col = BOT_GIZLI[t];
    if (col) { const _sel = b.select.bind(b); b.select = (...a) => _sel(...a).neq(col, BOT_ID); }
    return b;
  };
}
const ADMIN = "https://admin.tahtaapp.com";

const $ = (s, el = document) => el.querySelector(s);
const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEBEP = { 7: "Yapılan çözümler hatalı", 8: "Format kurallarına uyulmamış", 6: "Soruların çoğunluğu çözülmemiş", 4: "Yetersiz açıklama", 5: "Çözüm aşamaları anlaşılır değil", 1: "Görüntü kalitesi kötü", 2: "Yazı okunamıyor", 3: "Yapay zeka veya dış kaynak kullanımı", 9: "Uygunsuz içerik" };  // admin RejectSolver sebep kodları
const SIK_UYARI = 3, UYARI_TUR = ["F", "Y", "G", "GERI", "PASIF"];  // son 30 günde bu kadar uyarı alan "sık uyarı" sayılır
async function uyariSayilari() {
  const L = await q(sb.from("d_uyari").select("ogretmen_id,kademe,gonderim").eq("durum", "gonderildi").in("kademe", UYARI_TUR).gte("gonderim", new Date(Date.now() - 30 * 864e5).toISOString()).limit(5000));
  const N = {}; L.forEach(u => N[u.ogretmen_id] = (N[u.ogretmen_id] || 0) + 1); return N;
}
const sikEtiket = n => n >= SIK_UYARI ? ` <span class="etiket uyari" data-ipucu="Son 30 günde ${n} uyarı bildirimi gönderildi">Sık uyarı · ${n}</span>` : "";
const KADEME = { F: "Format hatırlatması", Y: "Yapay zekâ uyarısı", G: "Genel uyarı", PASIF: "Hesabı pasife alma", AKTIF: "Hesap yeniden açıldı", EKSI: "Puan eksiye düştü", KUCUK: "Küçük hatırlatma", GERI: "Günlük geri bildirim" };
const KAT = { yapay_zeka: "yapay zekâ", dijital_metin: "dijital metin", soru_ustune: "soru üstüne yazma", yanlis_cevap: "yanlış cevap", okunaklilik: "okunaklılık", eksik_aciklama: "eksik açıklama", diger: "diğer" };
const GERI_AL_SN = 30;  // Mac tarafı (senk.py GERI_AL_SN) bu süre dolmadan karara dokunmaz
let ben = null, sekme = "bugun";

// karar adları şikayet türüne göre (CS için açık)
const kararAdi = (tur, k) => tur === "s"
  ? ({ ONAYLA: "Onayla · soru kaldırılsın", REDDET: "Reddet · soru uygun", HAVUZA_AKTAR: "Doğru derse aktar" }[k] || e(k))
  : ({ ONAYLA: "Onayla · öğrenci haklı", REDDET: "Reddet · öğretmen haklı" }[k] || e(k));
const sonucAdi = (tur, k) => tur === "s"
  ? ({ ONAYLA: "Soru kaldırıldı", REDDET: "Soru uygun bulundu", HAVUZA_AKTAR: "Derse aktarıldı" }[k] || e(k))
  : ({ ONAYLA: "Öğrenci haklı", REDDET: "Öğretmen haklı", TEMIZ: "Temiz", SORUNLU: "Sorunlu", YZ_KESIN: "Yapay zekâ (kesin)" }[k] || e(k));
const gunu = t => new Date(t).toLocaleDateString("sv-SE");  // yerel (TR) gün, YYYY-AA-GG
const sonucRenk = k => ({ ONAYLA: "ok", HAVUZA_AKTAR: "ok", REDDET: "", TEMIZ: "ok", SORUNLU: "uyari", YZ_KESIN: "hata" }[k] ?? "");

function tarih(t) { if (!t) return ""; return new Date(t).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function haftaNo(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const g = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - g); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, "0")}`; }
async function q(p) { const { data, error } = await p; if (error) { bildir("Hata: " + error.message); throw error; } return data; }
const kisiLink = (seo, ad) => ad ? (seo ? `<a href="${ADMIN}/User/Detail/${e(seo)}" target="_blank" rel="noopener">${e(ad)}</a>` : `<span class="ad">${e(ad)}</span>`) : '<span class="soluk">—</span>';
const soruLink = (qid, yazi = "Soruyu admin panelde aç") => qid ? `<a href="${ADMIN}/Question/Detail/${qid}" target="_blank" rel="noopener">${yazi}</a>` : "";
// sayfa başı: açıklamanın ilk cümlesi görünür, kalanı "Devamı" ile açılır (tasarım tek satır istiyor, CS'nin bilgisi kaybolmasın)
const baslik = (b, a) => {
  const cumle = String(a).match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [""];
  let kisa = cumle[0], i = 1;
  while (i < cumle.length && (kisa + cumle[i]).length <= 110) kisa += cumle[i++];
  kisa = kisa.trim(); const uzun = cumle.slice(i).join("").trim();
  return `<div class="ust-cubuk"><div><h2>${b}</h2><p class="aciklama">${kisa}${uzun ? ` <button class="daha-ac" onclick="const p=this.closest('div').querySelector('.aciklama-tam');p.hidden=!p.hidden;this.textContent=p.hidden?'Devamı':'Kısalt'">Devamı</button>` : ""}</p>${uzun ? `<p class="aciklama-tam" hidden>${uzun}</p>` : ""}</div>${REHBER[sekme] ? '<button class="yardim-btn" title="Bu sayfa nasıl kullanılır?" onclick="rehberBaslat()"><i data-lucide="circle-help"></i></button>' : ""}</div>`;
};
const ikon = () => window.lucide && lucide.createIcons();

// ---------- toast + geri al ----------
function toast(baslik_, alt = "", geriAl = null) {
  const t = document.createElement("div"); t.className = "toast";
  t.innerHTML = `<div class="t-metin"><b>${e(baslik_)}</b>${alt ? `<span>${e(alt)}</span>` : ""}</div>${geriAl ? `<button class="geri-al">Geri al (${GERI_AL_SN})</button>` : ""}`;
  $("#toastlar").appendChild(t);
  const bas = Date.now(); let bitti = false;
  const kalan = () => GERI_AL_SN - Math.floor((Date.now() - bas) / 1000);
  const kapat = () => { if (bitti) return; bitti = true; clearInterval(say); t.remove(); };
  const say = setInterval(() => { const b = t.querySelector(".geri-al"); if (b) b.textContent = `Geri al (${kalan()})`; if (kalan() <= 0) kapat(); }, 500);
  if (!geriAl) { clearInterval(say); setTimeout(kapat, 3500); }
  t.querySelector(".geri-al")?.addEventListener("click", async () => { if (kalan() <= 0) return kapat(); kapat(); await geriAl(); });
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
  $("#giris").hidden = true; $("#uygulama").hidden = false;
  const bas = String(ben.ad || ben.email).trim().split(/\s+/).map(p => p[0]).join("").slice(0, 2).toLocaleUpperCase("tr") || "?";
  document.querySelectorAll(".k-ad").forEach(x => x.textContent = ben.ad);
  document.querySelectorAll(".k-rol").forEach(x => x.textContent = ben.rol === "yonetici" ? "Yönetici" : "Destek");
  document.querySelectorAll(".k-bas").forEach(x => x.textContent = bas);
  document.querySelectorAll(".sadece-yonetici").forEach(b => b.hidden = ben.rol !== "yonetici");
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
const cikisYap = async () => { await sb.auth.signOut(); location.hash = ""; girisGoster(); };
const sifreAc = () => { $("#s-hata").textContent = ""; $("#yeni-sifre").value = ""; $("#sifre-dlg").showModal(); };
document.querySelectorAll(".cikis").forEach(b => b.onclick = cikisYap);
document.querySelectorAll(".sifre-ac").forEach(b => b.onclick = sifreAc);
$("#sifre-kaydet").onclick = async ev => {
  ev.preventDefault(); const s = $("#yeni-sifre").value;
  if (s.length < 10) return $("#s-hata").textContent = "En az 10 karakter.";
  const { error } = await sb.auth.updateUser({ password: s });
  if (error) return $("#s-hata").textContent = error.message;
  $("#sifre-dlg").close(); bildir("Şifre değişti.");
};

// ---------- gezinme ----------
const darMenu = () => matchMedia("(max-width:1199px) and (min-width:768px)").matches;
$("#sekmeler").onclick = ev => {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.classList.contains("grup-bas")) return darMenu() ? git(b.dataset.ilk) : b.parentElement.classList.toggle("acik");
  if (b.dataset.s) git(b.dataset.s);
};
$("#alt-menu").onclick = ev => { const b = ev.target.closest("button[data-s]"); if (b) git(b.dataset.s); };
document.querySelectorAll(".zil").forEach(b => b.onclick = () => git("bugun"));
$("#m-hesap").onclick = () => git("daha");
$("#m-ara").onclick = () => { const u = $("#ust-arac"); u.classList.toggle("acik"); if (u.classList.contains("acik")) $("#ara").focus(); };

// ---------- tema: cihaza göre / açık / koyu ----------
function temaUygula(t) {
  try { localStorage.setItem("tema", t); } catch {}
  if (t === "sistem") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t === "koyu" ? "dark" : "light";
  document.querySelectorAll(".tema button").forEach(b => b.classList.toggle("secili", b.dataset.tema === t));
}
const temaSecili = () => { try { return localStorage.getItem("tema") || "sistem"; } catch { return "sistem"; } };
document.addEventListener("click", ev => { const b = ev.target.closest(".tema button[data-tema]"); if (b) temaUygula(b.dataset.tema); });
temaUygula(temaSecili());

// ---------- genel arama (⌘K): öğretmen, öğrenci, şikayet no ----------
let araZ, araSira = 0;
const araKapat = () => { $("#ara-sonuc").hidden = true; };
async function araYap() {
  const v = $("#ara").value.trim(), n = ++araSira, kutu = $("#ara-sonuc");
  if (v.length < 2) return araKapat();
  const temiz = v.replace(/[,()"\\%*]/g, " ").trim();
  const [O, S] = await Promise.all([
    sb.from("d_ogretmen").select("id,ad,durum").ilike("ad", `%${temiz}%`).limit(6),
    /^\d+$/.test(v) ? sb.from("d_sikayet").select("key,sikayet_id,ders,tur").eq("sikayet_id", +v).limit(3)
      : sb.from("d_sikayet").select("ogrenci,ogrenci_id").eq("tur", "c").ilike("ogrenci", `%${temiz}%`).limit(40),
  ]);
  if (n !== araSira) return;
  const ogr = /^\d+$/.test(v) ? [] : [...new Map((S.data || []).filter(x => x.ogrenci_id).map(x => [x.ogrenci_id, x.ogrenci])).entries()].slice(0, 6);
  const sik = /^\d+$/.test(v) ? S.data || [] : [];
  kutu.innerHTML = (O.data?.length ? `<div class="as-bas">Öğretmenler</div>${O.data.map(o => `<button data-git="ogretmen/${o.id}"><i data-lucide="graduation-cap"></i>${e(o.ad)}<small>${o.durum === "pasif" ? "Pasif" : ""}</small></button>`).join("")}` : "")
    + (ogr.length ? `<div class="as-bas">Öğrenciler</div>${ogr.map(([, ad]) => `<button data-ara="${e(ad)}"><i data-lucide="user"></i>${e(ad)}<small>şikayetleri</small></button>`).join("")}` : "")
    + (sik.length ? `<div class="as-bas">Şikayetler</div>${sik.map(s => `<button data-ara="${s.sikayet_id}"><i data-lucide="inbox"></i>#${s.sikayet_id} · ${e(s.ders || "")}<small>${s.tur === "s" ? "soru" : "cevap"}</small></button>`).join("")}` : "")
    || `<div class="as-bos">“${e(v)}” için sonuç yok.</div>`;
  kutu.hidden = false; ikon();
}
$("#ara").oninput = () => { clearTimeout(araZ); araZ = setTimeout(araYap, 250); };
$("#ara").onkeydown = ev => {
  if (ev.key === "Escape") { araKapat(); $("#ara").blur(); }
  if (ev.key === "Enter") { const ilk = $("#ara-sonuc button"); if (ilk) ilk.click(); else { const v = $("#ara").value.trim(); if (v) { araAc(v); } } }
};
function araAc(v) { araKapat(); $("#ara").value = ""; git("sikayet"); setTimeout(() => { const f = $("#f-ara"); if (f) { f.value = v; f.dispatchEvent(new Event("input")); } }, 60); }
$("#ara-sonuc").onclick = ev => {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.dataset.git) { araKapat(); $("#ara").value = ""; const [s, a] = b.dataset.git.split("/"); git(s, a); }
  else araAc(b.dataset.ara);
};
document.addEventListener("click", ev => { if (!ev.target.closest(".ara-kutu")) araKapat(); });
document.addEventListener("keydown", ev => { if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); $("#ust-arac").classList.add("acik"); $("#ara").focus(); } });

// ---------- sayfa durumları ----------
const iskelet = (n = 9) => `<div class="iskelet">${Array.from({ length: n }, () => "<div><span></span><span></span><span></span><span></span><span></span></div>").join("")}</div>`;
const ADLAR = { bugun: "Bugün", ozet: "Özet", gunluk: "Günlük", haftalik: "Haftalık rapor", bekleyen: "Kararını bekleyenler", kontrol: "Haftalık kontrol", uyari: "Uyarılar", ogretmen: "Öğretmenler", sikayet: "Tüm şikayetler",
  basvuru: "Solver başvuruları", takip: "Yakın takip", ogrenci: "Öğrenciler", eksi: "Eksi puanlılar", denetim: "Rastgele denetim", odeme: "Ödemeler", kesinti: "Hesap kesintileri", gonderici: "Cevap gönderici", daha: "Daha fazla" };
function git(s, alt) {
  sekme = s; location.hash = alt ? `${s}/${alt}` : s;
  document.querySelectorAll("#sekmeler button[data-s]").forEach(b => b.classList.toggle("secili", b.dataset.s === s));
  let grup = "";
  document.querySelectorAll("#sekmeler .grup").forEach(g => { const ic = !!g.querySelector(`button[data-s="${s}"]`); g.classList.toggle("aktif", ic); g.classList.toggle("acik", ic); if (ic) grup = g.dataset.grup; });
  const altlar = [...document.querySelectorAll("#alt-menu button")];
  altlar.forEach(b => b.classList.remove("secili"));
  (altlar.find(b => b.dataset.s === s) || altlar.find(b => grup && b.dataset.grup === grup) || altlar.find(b => b.dataset.s === "daha")).classList.add("secili");
  $("#ust-arac").classList.remove("acik"); araKapat(); window.scrollTo(0, 0);
  const f = { bugun, ozet, gunluk, haftalik, bekleyen, kontrol, uyari, ogretmen, sikayet, basvuru, takip, ogrenci, eksi, denetim, odeme, kesinti, gonderici, daha }[s] || bugun;
  $("#icerik").innerHTML = baslik(ADLAR[s] || "", "") + iskelet();
  Promise.resolve().then(() => f(alt)).then(() => { ikon(); klampBagla(); }).catch(err => {
    if (sekme !== s) return;
    console.error(err);
    $("#icerik").innerHTML = baslik(ADLAR[s] || "", "") + `<div class="durum-hata"><span class="dh-ikon"><i data-lucide="cloud-off"></i></span><b>${e(ADLAR[s] || "Sayfa")} yüklenemedi</b>Bağlantıyı kontrol edip yeniden dene.<button class="ince" onclick="git('${s}'${alt ? `,'${e(alt)}'` : ""})">Tekrar dene</button></div>`;
    ikon();
  });
}

// ---------- daha fazla (mobil) ----------
function daha() {
  const r = id => { const x = document.getElementById(id); return x?.textContent ? `<b class="rozet">${x.textContent}</b>` : ""; };
  const sat = (s, ik, ad, roz = "") => `<button data-s="${s}"><i data-lucide="${ik}"></i><span>${ad}</span>${roz}<i data-lucide="chevron-right" class="ok-sag"></i></button>`;
  const yon = ben?.rol === "yonetici";
  $("#icerik").innerHTML = baslik("Daha fazla", "Tüm sayfalar.") + `
    <div class="daha-grup"><h4>Raporlar</h4>${sat("ozet", "layout-grid", "Özet")}${sat("gunluk", "chart-column", "Günlük")}${sat("haftalik", "calendar", "Haftalık rapor")}</div>
    <div class="daha-grup"><h4>Şikayetler</h4>${sat("bekleyen", "inbox", "Kararını bekleyenler", r("r-bekleyen"))}${sat("kontrol", "check", "Haftalık kontrol", r("r-kontrol"))}${sat("sikayet", "list-checks", "Tüm şikayetler")}</div>
    <div class="daha-grup"><h4>Öğretmenler</h4>${sat("ogretmen", "graduation-cap", "Öğretmen listesi")}${sat("uyari", "bell", "Uyarılar", r("r-uyari"))}${sat("takip", "eye", "Yakın takip")}${sat("denetim", "target", "Rastgele denetim")}${sat("eksi", "triangle-alert", "Eksi puanlılar")}${sat("kesinti", "shield-check", "Hesap kesintileri", r("r-kesinti"))}${sat("odeme", "wallet", "Ödemeler", r("r-odeme"))}</div>
    <div class="daha-grup"><h4>Diğer</h4>${sat("basvuru", "award", "Solver başvuruları", r("r-basvuru"))}${sat("ogrenci", "users", "Öğrenciler")}${yon ? sat("gonderici", "send", "Cevap gönderici") : ""}</div>
    <div class="daha-grup"><h4>Hesap · ${e(ben?.ad || "")}</h4>
      <div style="padding:6px 12px 10px"><div class="tema"><button data-tema="sistem" title="Cihaza göre"><i data-lucide="clock"></i></button><button data-tema="acik" title="Açık"><i data-lucide="sun"></i></button><button data-tema="koyu" title="Koyu"><i data-lucide="moon"></i></button></div></div>
      <button class="sifre-ac"><i data-lucide="key-round"></i><span>Şifre değiştir</span></button><button class="cikis"><i data-lucide="log-out"></i><span>Çıkış yap</span></button></div>`;
  $("#icerik").querySelectorAll("button[data-s]").forEach(b => b.onclick = () => git(b.dataset.s));
  $("#icerik").querySelector(".sifre-ac").onclick = sifreAc; $("#icerik").querySelector(".cikis").onclick = cikisYap;
  temaUygula(temaSecili());
}
async function rozetler() {
  const [b, k, u, kb, bb] = await Promise.all([
    sb.from("d_sikayet").select("key,d_karar(id,tip,uygulandi)").eq("durum", "bekliyor"),
    sb.from("d_sikayet").select("key,d_karar(id,tip)").eq("kontrol_hafta", haftaNo()),
    sb.from("d_uyari").select("id", { count: "exact", head: true }).eq("durum", "taslak"),
    sb.from("d_basvuru").select("id", { count: "exact", head: true }).eq("kontrol_hafta", haftaNo()).is("kontrol_secim", null),
    sb.from("d_basvuru").select("id", { count: "exact", head: true }).eq("durum", "bekliyor").is("insan_karar", null),
  ]);
  $("#r-bekleyen").textContent = (b.data || []).filter(x => !x.d_karar.some(k => k.tip === "bekleyen")).length || "";
  $("#r-kontrol").textContent = ((k.data || []).filter(x => !x.d_karar.some(k => k.tip === "kontrol")).length + (kb.count || 0)) || "";
  $("#r-uyari").textContent = u.count || "";
  const rb = document.getElementById("r-basvuru"); if (rb) rb.textContent = bb.count || "";
  const ro = document.getElementById("r-odeme");
  if (ro && ben?.rol === "yonetici") { const od = await sb.from("d_odeme").select("id", { count: "exact", head: true }).eq("durum", "odenecek").not("odenecek", "is", null); ro.textContent = od.count || ""; }
  const rk = document.getElementById("r-kesinti");
  if (rk && ben?.rol === "yonetici") { const ks = await sb.from("d_kesinti").select("ogretmen_id", { count: "exact", head: true }).eq("durum", "hazir"); rk.textContent = ks.count || ""; }
  const top = ids => ids.reduce((a, i) => a + (+$(i).textContent || 0), 0) || "";
  $("#r-sikayet-grup").textContent = top(["#r-bekleyen", "#r-kontrol"]); $("#r-ogretmen-grup").textContent = top(["#r-uyari", "#r-kesinti", "#r-odeme"]);
  const is = top(["#r-bekleyen", "#r-kontrol", "#r-uyari", "#r-basvuru"]);
  document.querySelectorAll(".zil .nokta").forEach(n => n.hidden = !is);
}

// ---------- medya çifti (soru | cevap) ----------
function medya(soruL, cevapL, video, cevapEtiket, tekli) {
  const hepsi = [...(soruL || []), ...(cevapL || []), ...(video ? [video] : [])];
  const kutu = (L, etiket, mor, bas, vid) => {
    if (vid) return `<div class="m-kutu" data-galeri="${bas}"><span class="m-chip ${mor ? "mor" : ""}">${e(etiket)}</span><video src="${e(vid)}#t=0.5" preload="metadata" muted></video><div class="m-oynat"><span>▶</span></div></div>`;
    if (!L || !L.length) return `<div class="m-kutu bos-m">${e(etiket || "Cevap")} görseli yok</div>`;
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
  const durum = s.durum === "hata" ? '<span class="etiket hata" data-ipucu="Admin paneline yazılırken yanıt alınamadı ve kayıt artık bekleyenlerde değil. Admin panelde bu şikayetin sonucuna bakın.">Admin\'de kontrol et</span>' : s.durum === "islendi" ? `<span class="etiket ${sonucRenk(s.son_karar)}">${sonucAdi(s.tur, s.son_karar)}</span>` : '<span class="etiket uyari">Karar bekliyor</span>';
  const hedef = s.hedef_ders ? ` → ${e(s.hedef_ders)}` : "";
  const karar = `<div class="sk-karar"><div class="sk-karar-satir"><span class="kl">İlk inceleme: ${kararAdi(s.tur, s.ajan_karar).split(" · ")[0]}${s.ajan_karar === "HAVUZA_AKTAR" ? hedef : ""}</span>
    ${s.emin_degil ? '<span class="etiket uyari" data-ipucu="İlk inceleme bu kayıtta emin olamadı, bu yüzden karar sana bırakıldı.">emin değil</span>' : ""}
    ${s.dogru_cevap ? `<span class="soluk">Doğru cevap: ${e(s.dogru_cevap)}${s.ogretmen_cevabi ? ` · Öğretmenin cevabı: ${e(s.ogretmen_cevabi)}` : ""}</span>` : ""}</div>
    <div class="klamp">${e(s.gerekce)}</div>
    ${s.oneri ? `<div class="sk-karar-satir"><span class="kl mor" data-ipucu="İlk inceleme emin olamayınca kayda ikinci kez bakıldı; bu, o ikinci bakışın önerisi.">İkinci kontrol: ${kararAdi(s.tur, s.oneri).split(" · ")[0]}</span></div><div class="klamp">${e(s.oneri_gerekce)}</div>` : ""}</div>`;
  let alt = "";
  if (mod === "bekleyen") {
    const sec = ["ONAYLA", "REDDET"].concat(!cevapli && s.hedef_lecture_id ? ["HAVUZA_AKTAR"] : []);
    alt = `<div class="aksiyon">${sec.map(x => `<button class="secim ${x === "REDDET" ? "ret" : "onay"}" data-v="${x}">${kararAdi(s.tur, x)}${x === "HAVUZA_AKTAR" ? hedef : ""}</button>`).join("")}
      <input class="not" placeholder="Not (isteğe bağlı): neden bu karar?">${cevapli ? '<input class="kucuk-not" placeholder="Reddederken öğretmene küçük not (isteğe bağlı), ör. fotoğraf loş" data-ipucu="Şikayeti reddetseniz de cevapta küçük bir sorun varsa buraya yazın. Bu notlar birikir, öğretmene toplu hatırlatma olarak gider; ücreti ve puanı etkilemez.">' : ""}<button class="birincil kucuk kaydet">Kaydet</button></div>`;
  } else if (mod === "kontrol") {
    alt = `<div class="aksiyon"><button class="secim onay" data-v="DOGRU">Karar doğru</button><button class="secim ret" data-v="YANLIS">Karar yanlış</button>
      <input placeholder="Yanlışsa neden? (zorunlu)"><button class="birincil kucuk kaydet">Kaydet</button></div>`;
  }
  const takipMi = String(s.key).startsWith("t:");
  return `<section class="kart sk" data-key="${e(s.key)}" data-mod="${mod}" data-tur="${s.tur}">
    <div class="sk-ust"><span class="etiket">${takipMi ? (s.kaynak === "denetim" ? "Rastgele denetim" : "Yakın takip") : cevapli ? "Cevap şikayeti" : "Soru şikayeti"}</span><b>${e(s.ders)}</b>
      <span class="soluk">${tarih(s.olusturma)}${takipMi ? "" : ` · şikayet no ${s.sikayet_id}`}</span><span class="sag">${durum}</span></div>
    <div class="sk-kisiler">
      ${takipMi ? "" : `<span>Öğrenci: ${kisiLink(s.ogrenci_seo, s.ogrenci)}</span>`}
      <span>${cevapli ? "Öğretmen" : "Şikayet eden öğretmen"}: ${kisiLink(s.ogretmen_seo, s.ogretmen)}</span>
      ${s.ogretmen_id ? `<a class="kucuk-link" href="#" onclick="event.preventDefault();git('ogretmen','${s.ogretmen_id}')">Öğretmenin geçmişi</a>` : ""}
      ${s.question_id ? `<span class="kucuk-link">${soruLink(s.question_id, "Soruyu aç")}</span>` : ""}</div>
    <div class="sk-govde">${bilgi.some(x => x[1]) ? `<dl class="sk-bilgi">${bilgi.filter(x => x[1]).map(([a, b]) => `<div><dt>${a}</dt><dd>${e(b)}</dd></div>`).join("")}</dl>` : "<div></div>"}
    ${medya(s.soru_url, s.cevap_url, s.video_url, cevapli ? (s.ogretmen || "Cevap") : "", !cevapli)}</div>
    ${karar}${alt}</section>`;
}
function kartlariBagla(kok, yenile) {
  const s0 = sekme;
  kok.querySelectorAll("section.sk[data-mod=bekleyen],section.sk[data-mod=kontrol]").forEach(kart => {
    let secim = null;
    kart.querySelectorAll(".secim").forEach(b => b.onclick = () => { secim = b.dataset.v; kart.querySelectorAll(".secim").forEach(x => x.classList.toggle("secili", x === b)); });
    const k = kart.querySelector(".kaydet");
    k.onclick = async () => {
      if (!secim) return bildir("Önce bir seçim yap.");
      const not = kart.querySelector(".aksiyon input").value.trim(), tip = kart.dataset.mod === "kontrol" ? "kontrol" : "bekleyen", key = kart.dataset.key, kucuk = kart.querySelector(".kucuk-not")?.value.trim() || null;
      if (tip === "kontrol" && secim === "YANLIS" && not.length < 3) return bildir("Yanlış dediysen kısaca nedenini yaz.");
      k.disabled = true;
      const { error } = await sb.rpc("d_karar_ver", { p_key: key, p_tip: tip, p_secim: secim, p_not: not, p_kucuk: secim === "REDDET" ? kucuk : null });
      k.disabled = false;
      if (error) return bildir(error.message === "zaten_islendi" ? "Bu kayıt zaten işlenmiş." : error.message === "isleniyor" ? "Bu kayda verilen karar şu an admin paneline işleniyor, değiştirilemez." : "Kaydedilemedi: " + error.message);
      kart.classList.add("gidiyor"); setTimeout(() => { kart.remove(); bosKontrol(kok); }, 250); rozetler();
      toast(tip === "kontrol" ? "Kontrol kaydedildi" : "Karar kaydedildi", tip === "kontrol" ? "Teşekkürler." : "30 saniye içinde geri alabilirsin, sonra 1-2 dakika içinde admin paneline işlenir.", async () => {
        const r = await sb.rpc("d_karar_geri_al", { p_key: key, p_tip: tip });
        if (r.error) return bildir("Geri alınamadı: süre doldu ya da karar işlenmeye başladı.");
        bildir("Geri alındı."); rozetler(); sekme === s0 && yenile && yenile();
      });
    };
  });
}
function bosKontrol(kok) { if (!kok.querySelector("section.sk[data-mod]") && kok.querySelector(".bos-yer")) kok.querySelector(".bos-yer").innerHTML = '<div class="bos">Hepsi bitti.</div>'; }

// ---------- özet ----------
function saglikTablo(S, bugun, M) {
  // Mac'teki her adımın son çalışması (saglik.json → d_durum 'saglik'); eskiyse turuncu
  if (!S) return "";
  const ne = { cek: ["Şikayet çekme", 60, x => `${x.yeni ?? 0} yeni${x.bekleyen ? `, ${x.bekleyen} birikmesi bekleniyor` : ""}${x.medya_hatasi ? `, ${x.medya_hatasi} medya indirilemedi` : ""}${x.talimat ? `, ${x.talimat} talimat benzeri metin` : ""}`],
    ajan_sikayet: ["Şikayet ajanları", 24 * 60, x => `${x.paket} paket${x.bos ? `, ${x.bos} boş döndü` : ""}${x.atilan ? `, ${x.atilan} pakette geçersiz karar atıldı` : ""}`],
    isle: ["Admin'e yazma", 24 * 60, x => `${x.basarili} işlendi${x.hata ? `, ${x.hata} yazılamadı` : ""}${x.insana ? `, ${x.insana} size düştü` : ""}`],
    ajan_basvuru: ["Başvuru ajanları", 7 * 24 * 60, x => `${x.paket} başvuru${x.bos ? `, ${x.bos} boş döndü` : ""}`],
    takip: ["Yakın takip", 6 * 60, x => `${x.cevap} cevap kontrol edildi`],
    denetim: ["Rastgele denetim", 30 * 60, x => `${x.cevap} cevap kontrol edildi`],
    solver_puan: ["Eksi puan takibi", 3 * 60, x => `${x.okunan}/${x.aktif} solver okundu, ${x.eksi} eksi puanlı`] };
  const satir = Object.entries(ne).filter(([k]) => S[k]).map(([k, [ad, sinir, f]]) => {
    const dk = Math.round((Date.now() / 1000 - S[k].zaman) / 60), eski = dk > sinir;
    return `<tr><td>${ad}</td><td><span class="zaman-cip ${eski ? "eski" : ""}">${dk < 60 ? dk + " dk" : dk < 1440 ? Math.round(dk / 60) + " sa" : Math.round(dk / 1440) + " gün"} önce</span></td><td>${e(f(S[k]))}</td></tr>`;
  }).join("");
  const insana = bugun.filter(x => x.durum === "bekliyor").length;
  const mal = M ? ` Son 24 saatte ajanların API karşılığı maliyeti: $${M.son_24_saat_usd} (${M.kayit} kayıt; abonelikte ödenmez, kota ölçüsüdür).` : "";
  return `<h2 id="oz-saglik">Sistem sağlığı</h2><p class="aciklama">Bugün sana düşen: ${insana} / ${bugun.length} şikayet${bugun.length ? ` (%${Math.round(insana / bugun.length * 100)})` : ""}. Bu oran zamanla düşmeli.${mal}</p>
    <div class="tablo-sar"><table class="tablo sik"><tr><th style="width:200px">Adım</th><th style="width:160px">Son çalışma</th><th>Son sonuç</th></tr>${satir}</table></div>`;
}
// ---------- bugün: günlük 10 dakikalık iş listesi ----------
async function bugun() {
  const h = haftaNo();
  const [bek, kon, konB, tas, bas, hata, dur] = await Promise.all([
    q(sb.from("d_sikayet").select("key,d_karar(tip)").eq("durum", "bekliyor")),
    q(sb.from("d_sikayet").select("key,d_karar(tip)").eq("kontrol_hafta", h)),
    sb.from("d_basvuru").select("id", { count: "exact", head: true }).eq("kontrol_hafta", h).is("kontrol_secim", null),
    q(sb.from("d_uyari").select("kademe").eq("durum", "taslak")),
    sb.from("d_basvuru").select("id", { count: "exact", head: true }).eq("durum", "bekliyor").is("insan_karar", null),
    sb.from("d_sikayet").select("key", { count: "exact", head: true }).eq("durum", "hata"),
    q(sb.from("d_durum").select("*").eq("k", "saglik")),
  ]);
  const nBek = bek.filter(x => !x.d_karar.some(k => k.tip === "bekleyen")).length;
  const nKon = kon.filter(x => !x.d_karar.some(k => k.tip === "kontrol")).length + (konB.count || 0);
  const nPas = tas.filter(t => t.kademe === "PASIF").length, nTas = tas.length - nPas;
  const S = dur[0]?.v || {}, sinir = { cek: 60, isle: 1440, ajan_sikayet: 1440 };
  const eski = Object.entries(sinir).filter(([k, m]) => S[k] && (Date.now() / 1000 - S[k].zaman) / 60 > m).map(([k]) => ({ cek: "şikayet çekme", isle: "admin'e yazma", ajan_sikayet: "şikayet ajanları" })[k]);
  // [sayfa, başlık, sayı, dakika/iş, açıklama, önem: uyari | hata | bilgi]
  const is = [
    ["bekleyen", "Kararını bekleyen şikayetler", nBek, 0.5, "Ajanın emin olamadığı şikayetler. Görsellere bakıp karar verin; notunuz kurallara eklenir.", "uyari"],
    ["uyari", "Hesap kapatma önerileri", nPas, 1, "Yapay zekâ kanıtını dikkatle inceleyin; onay hesabı kapatır.", "hata"],
    ["uyari", "Onay bekleyen bildirim taslakları", nTas, 0.2, "Geri bildirim, küçük hatırlatma ve uyarılar. Okuyup onaylayın ya da \"gönderme\" deyin.", "uyari"],
    ["basvuru", "Kararınızı bekleyen solver başvuruları", bas.count || 0, 1, "Ajanın emin olamadığı başvurular.", "uyari"],
    ["kontrol", "Bugünün kontrolü", nKon, 0.3, "Otomatik kararlardan rastgele seçilenler: doğru mu, yanlış mı?", "mor"],
    ["sikayet", "Admin'de kontrol edilecek", hata.count || 0, 1, "Admin'e yazılırken yanıt alınamayan şikayetler. Admin'de sonucuna bakın.", "hata"],
  ];
  const kalan = is.filter(x => x[2] > 0), dk = Math.max(1, Math.round(kalan.reduce((a, x) => a + x[2] * x[3], 0)));
  const IK = { uyari: "circle-alert", hata: "triangle-alert", mor: "info" };
  $("#icerik").innerHTML = baslik("Bugün", `Günlük kontrolünüz için tek liste. Her satır ilgili sayfayı açar. ${kalan.length ? `Şu an ${kalan.length} iş bekliyor, tahmini ${dk} dakika.` : "Bugün için yapılacak iş kalmadı."} Hepsi tamamlanınca sistem kendi başına çalışır.`) + `
    ${eski.length ? `<div class="bilgi-serit"><i data-lucide="clock"></i>Uzun süredir çalışmayan adım: ${e(eski.join(", "))}. Ulaş'a haber ver.</div>` : ""}
    <div class="is-liste">${is.map(([s, ad, n, , acik, onem]) => `<button class="is-satir ${n ? onem : "mor"}" onclick="git('${s}')">
      <span class="is-ikon"><i data-lucide="${n ? IK[onem] : "info"}"></i></span><span class="is-metin"><b>${ad}</b><span>${acik.replace(/^([^.]+[.])\s*(.+)$/, (m, a, b) => `${a}<span class="m-gizle"> ${b}</span>`)}</span></span>
      <span class="is-sayi">${n || "Tamam"}</span><i data-lucide="chevron-right" class="ok-sag"></i></button>`).join("")}</div>`;
}

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
  const kutu = (ik, bas, s, a, cls = "", id = "") => `<div class="kutu ${cls}" ${id ? `id="${id}"` : ""}><div class="k-bas"><i data-lucide="${ik}"></i>${bas}</div><div class="s">${s}</div><div class="e">${a}</div></div>`;
  const havuzN = say(x => x.son_karar === "HAVUZA_AKTAR");
  $("#icerik").innerHTML = baslik("Özet", "Günün durumu tek bakışta; şikayetler 20 dakikada bir kontrol edilir. Bu panelde verdiğin kararlar 30 saniyelik geri alma süresinden sonra 1-2 dakika içinde admin paneline işlenir.") + `
    <div class="kutular">
      ${kutu("clock", "Son kontrol", dk === null ? "—" : dk < 60 ? dk + " dk" : Math.round(dk / 60) + " sa", "son otomatik kontrolden bu yana", dk !== null && dk > 50 ? "uyari" : "", "oz-kontrol")}
      ${kutu("shield-check", "Admin paneli", oturum === "dustu" ? "Kopuk" : "Bağlı", "bağlantı durumu", oturum === "dustu" ? "hata" : "", "oz-baglanti")}
      ${kutu("inbox", "Bugün incelenen", bugun.length, "şikayet")}
      ${kutu("check", "Bugün onay / ret", say(x => x.son_karar === "ONAYLA" || x.son_karar === "HAVUZA_AKTAR") + " / " + say(x => x.son_karar === "REDDET"), havuzN ? `${havuzN} derse aktarma` : "onaylanan / reddedilen")}
      ${kutu("flag", "Kararını bekleyen", bek.count ?? 0, "senin kararın", bek.count ? "uyari" : "", "oz-bekleyen")}
      ${kutu("bell", "Onay bekleyen uyarı", taslak.count ?? 0, "bildirim taslağı", taslak.count ? "uyari" : "")}
      ${kutu("user", "Pasif öğretmen", pasifN.count ?? 0, "hesabı kapalı")}
      ${kutu("target", "Karar doğruluğu", dogruluk === null ? "—" : "%" + dogruluk, `${kontrolN} kontrol`, dogruluk !== null && dogruluk < 90 ? "uyari" : "", "oz-dogruluk")}
    </div>
    ${saglikTablo(D.saglik?.v, bugun, D.maliyet?.v)}
    <h2 id="oz-kontroller">Son otomatik kontroller</h2>
    ${turlar.length ? turlar.map(t => { const ozet = `${t.soru_n + t.cevap_n} şikayet · ${t.onay} onay · ${t.ret} ret${t.havuz ? " · " + t.havuz + " derse aktarma" : ""}${t.bekleyen ? " · " + t.bekleyen + " karar bekliyor" : ""}`;
      return t.ozet ? `<details class="tur-satir"><summary><b>${tarih(t.zaman)}</b><span class="soluk">${ozet}</span><span class="ts-ac">Neler oldu</span><i data-lucide="chevron-down"></i></summary><pre class="ozet">${e(t.ozet)}</pre></details>`
        : `<div class="tur-satir"><div class="tur-satir-ic" style="display:flex;gap:16px;padding:14px 16px;align-items:center"><b>${tarih(t.zaman)}</b><span class="soluk" style="font-size:12px">${ozet}</span></div></div>`; }).join("") : '<div class="bos">Henüz kontrol yapılmadı.</div>'}`;
}

async function tumSikayetler(gun) {
  const s = new Date(Date.now() - gun * 864e5).toISOString(); let L = [], i = 0;
  while (true) {
    const d = await q(sb.from("d_sikayet").select("key,tur,son_karar,durum,olusturma,ogretmen,ogretmen_id,gerekce,kategori,question_id,ogrenci,ogrenci_id,ogrenci_seo").gte("olusturma", s).order("olusturma").range(i, i + 999));
    L = L.concat(d); if (d.length < 1000) break; i += 1000;
  }
  return L;
}
async function gunluk() {
  const L = await tumSikayetler(30), G = {};
  for (const s of L) {
    const g = gunu(s.olusturma), o = G[g] ||= { s: 0, c: 0, onay: 0, ret: 0, havuz: 0, bek: 0 };
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

// ---------- haftalık rapor ----------
async function haftalik() {
  const gun = new Date(); gun.setHours(0, 0, 0, 0);
  const bas = new Date(gun - 7 * 864e5), onc = new Date(gun - 14 * 864e5), iso = d => d.toISOString();
  const [S, U, B, K, KB, E, T] = await Promise.all([
    tumSikayetler(14),
    q(sb.from("d_uyari").select("kademe,durum,gonderim").gte("gonderim", iso(bas))),
    q(sb.from("d_basvuru").select("karar,sebep").gte("islem_zamani", iso(bas))),
    q(sb.from("d_karar").select("secim").eq("tip", "kontrol").gte("zaman", iso(bas))),
    q(sb.from("d_basvuru").select("kontrol_secim").gte("kontrol_zamani", iso(bas))),
    q(sb.from("d_solver_puan").select("ad,seo,puan").lt("puan", 0)),
    q(sb.from("d_takip").select("kaynak,sonuc").gte("olusturma", iso(bas))),
  ]);
  const bu = S.filter(s => s.olusturma >= iso(bas)), ge = S.filter(s => s.olusturma < iso(bas) && s.olusturma >= iso(onc));
  const onay = L => L.filter(s => s.son_karar === "ONAYLA" || s.son_karar === "HAVUZA_AKTAR").length;
  const O = {}; bu.filter(s => s.tur === "c" && s.son_karar === "ONAYLA" && s.ogretmen_id).forEach(s => { const o = O[s.ogretmen_id] ||= { ad: s.ogretmen, n: 0, k: {} }; o.n++; kategori(s).forEach(c => o.k[c] = (o.k[c] || 0) + 1); });
  const kN = K.length + KB.length, kD = K.filter(x => x.secim === "DOGRU").length + KB.filter(x => x.kontrol_secim === "DOGRU").length;
  const fark = (a, b) => `${a} <span class="soluk">(önceki hafta ${b})</span>`, sat = (a, b) => `<tr><td class="soluk">${a}</td><td><b>${b}</b></td></tr>`;
  const say = (L, f) => L.filter(f).length, tabl = (id, r) => `<div class="tablo-sar" ${id ? `id="${id}"` : ""}><table class="tablo sik">${r}</table></div>`;
  const den = T.filter(x => x.kaynak === "denetim"), tak = T.filter(x => x.kaynak === "takip");
  const tarihAralik = `${bas.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} – ${new Date(gun - 864e5).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}`;
  $("#icerik").innerHTML = baslik("Haftalık rapor", `Son 7 günün özeti (${tarihAralik}), önceki haftayla karşılaştırmalı. Her gün güncellenir.`) + `
    <h2>Şikayetler</h2>${tabl("h-sikayet", sat("İncelenen şikayet", fark(bu.length, ge.length)) + sat("Soru / cevap şikayeti", `${say(bu, s => s.tur === "s")} / ${say(bu, s => s.tur === "c")}`) +
      sat("Onaylanan (şikayet eden haklı)", fark(onay(bu), onay(ge))) + sat("Reddedilen", say(bu, s => s.son_karar === "REDDET")) + sat("Kararını bekleyen", say(bu, s => s.durum === "bekliyor")) +
      sat("Otomatik karar doğruluğu", kN ? `%${Math.round(kD / kN * 100)} (${kN} kontrol)` : "bu hafta kontrol yapılmadı"))}
    <h2>En çok şikayeti onaylanan öğretmenler</h2>${tabl("", Object.entries(O).sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([id, o]) => `<tr class="tik" onclick="git('ogretmen','${id}')"><td>${e(o.ad)}</td><td><b>${o.n}</b></td><td class="soluk">${Object.entries(o.k).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${KAT[k] || k} ${v}`).join(", ")}</td></tr>`).join("") || '<tr><td class="soluk">Yok.</td></tr>')}
    <h2>Öğretmenlere giden bildirimler</h2>${tabl("", Object.entries(U.filter(u => u.durum === "gonderildi" || u.kademe === "AKTIF").reduce((a, u) => (a[KADEME[u.kademe] || u.kademe] = (a[KADEME[u.kademe] || u.kademe] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => sat(k, v)).join("") || sat("Bildirim yok", ""))}
    <h2>Rastgele denetim ve yakın takip</h2>${tabl("", sat("Rastgele denetlenen cevap", `${den.length} · sorunlu ${say(den, x => x.sonuc !== "TEMIZ")}${den.length ? ` (%${Math.round(say(den, x => x.sonuc !== "TEMIZ") / den.length * 100)})` : ""}`) +
      sat("Yakın takipte kontrol edilen", `${tak.length} · sorunlu ${say(tak, x => x.sonuc !== "TEMIZ")} · yapay zekâ ${say(tak, x => x.sonuc === "YZ_KESIN")}`))}
    <h2>Solver başvuruları</h2>${tabl("", sat("Değerlendirilen", B.length) + sat("Onaylanan", say(B, b => b.karar === "ONAYLA")) + Object.entries(B.filter(b => b.karar !== "ONAYLA").reduce((a, b) => (a[b.sebep] = (a[b.sebep] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => sat("Ret · " + e(k), v)).join(""))}
    <h2>Puan</h2>${tabl("", sat("Şu an eksi puanlı solver", E.map(x => `${kisiLink(x.seo, x.ad)} (${Number(x.puan)})`).join(", ") || "yok"))}`;
}

// ---------- kararını bekleyenler ----------
async function bekleyen() {
  const L = await q(sb.from("d_sikayet").select("*,d_karar(*)").eq("durum", "bekliyor").order("olusturma"));
  const acik = L.filter(s => !s.d_karar.some(k => k.tip === "bekleyen")), sirada = L.length - acik.length;
  $("#icerik").innerHTML = baslik("Kararını bekleyenler", "Otomatik incelemenin emin olamadığı şikayetler burada senin kararını bekler. Soru ve cevap görsellerine bak, bir karar seç, istersen not yaz ve Kaydet'e bas. Kayıt ekrandan kalkar, 30 saniye içinde geri alabilirsin; sonra 1-2 dakika içinde admin paneline işlenir.") + `
    ${sirada ? `<div class="bilgi-serit"><i data-lucide="clock"></i>${sirada} kararın admin paneline işlenmeyi bekliyor.</div>
      <div class="tablo-sar"><table class="tablo sik"><tr><th>Şikayet</th><th>Verilen karar</th><th>Kim</th><th>Durum</th></tr>${L.filter(s => !acik.includes(s)).map(s => { const k = s.d_karar.filter(x => x.tip === "bekleyen").pop();
        return `<tr><td>${e(s.ogretmen || "")} <span class="soluk">${e(s.ders || "")}</span></td><td>${kararAdi(s.tur, k.secim)}</td><td class="soluk">${e(k.kim)}</td><td>${k.uygulama_notu ? `<span class="etiket hata">${e(k.uygulama_notu)}</span>` : '<span class="soluk">sırada</span>'}</td></tr>`; }).join("")}</table></div>` : ""}
    <div class="bos-yer">${acik.length ? acik.map(s => sikayetKart(s, "bekleyen")).join("") : '<div class="bos">Bekleyen kayıt yok.</div>'}</div>`;
  kartlariBagla($("#icerik"), bekleyen);
}

// ---------- haftalık kontrol ----------
async function kontrol() {
  const h = haftaNo();
  const [L, B] = await Promise.all([q(sb.from("d_sikayet").select("*,d_karar(*)").eq("kontrol_hafta", h).order("olusturma")), q(sb.from("d_basvuru").select("*").eq("kontrol_hafta", h).order("id"))]);
  const acik = L.filter(s => !s.d_karar.some(k => k.tip === "kontrol")), bacik = B.filter(b => !b.kontrol_secim);
  $("#icerik").innerHTML = baslik("Haftalık kontrol", "Otomatik kararların doğru olup olmadığını ölçmek için her hafta rastgele birkaç karar seçilir. Her birine bak: karar doğruysa \"Karar doğru\", yanlışsa \"Karar yanlış\" seç ve nedenini yaz. Yazdığın neden kurallara eklenir ve sonraki kararlarda dikkate alınır. Yanlış bir kararı admin panelinde ayrıca elle düzeltmen gerekir.") + `
    <div class="bilgi-serit"><i data-lucide="list-checks"></i>Şikayetler: ${L.length - acik.length}/${L.length} · Solver başvuruları: ${B.length - bacik.length}/${B.length} tamamlandı.</div>
    <h2>Şikayet kararları</h2><div class="bos-yer">${acik.length ? acik.map(s => sikayetKart(s, "kontrol")).join("") : '<div class="bos">Bu haftanın şikayet kontrolleri bitti.</div>'}</div>
    <h2>Solver başvuru kararları</h2><div class="bos-yer b-yer">${bacik.length ? bacik.map(b => basvuruKart(b, true)).join("") : '<div class="bos">Bu haftanın başvuru kontrolleri bitti.</div>'}</div>`;
  kartlariBagla($("#icerik"), kontrol); basvuruBagla(kontrol);
}

// ---------- uyarılar ----------
async function uyari() {
  const [acik, gecmis] = await Promise.all([
    q(sb.from("d_uyari").select("*").in("durum", ["taslak", "onaylandi"]).order("id")),
    q(sb.from("d_uyari").select("*").in("durum", ["gonderildi", "gonderiliyor", "iptal", "hata"]).order("id", { ascending: false }).limit(300)),
  ]), NU = await uyariSayilari();
  const kanitlar = [...new Set(acik.flatMap(u => u.kanit || []))];
  // kanıt anahtarı: "c123" şikayet · "t:…" takip/denetim · "k:…" küçük hatırlatma notu (şikayet ya da denetim kaydı)
  const coz = k => { const a = k.replace(/^[tk]:/, ""); return k.startsWith("t:") || !/^[cs]\d+$/.test(a) ? ["t", a] : ["s", a]; };
  const ks = [...new Set(kanitlar.filter(k => coz(k)[0] === "s").map(k => coz(k)[1]))], kt = [...new Set(kanitlar.filter(k => coz(k)[0] === "t").map(k => coz(k)[1]))];
  const KS = Object.fromEntries(ks.length ? (await q(sb.from("d_sikayet").select("*").in("key", ks))).map(s => [s.key, s]) : []);
  const KT = Object.fromEntries(kt.length ? (await q(sb.from("d_takip").select("*").in("key", kt))).map(s => [s.key, takipKayit(s)]) : []);
  const K = Object.fromEntries(kanitlar.map(k => [k, coz(k)[0] === "s" ? KS[coz(k)[1]] : KT[coz(k)[1]]]));
  const kart = u => { const kn = (u.kanit || []).filter(k => K[k]);
    return `<section class="kart u-kart" data-id="${u.id}" data-durum="${e(u.durum)}">
    <div class="kart-ust"><a class="u-ad" href="#" title="Öğretmenin geçmişi" onclick="event.preventDefault();git('ogretmen','${u.ogretmen_id}')">${e(u.ad)}</a>${sikEtiket(NU[u.ogretmen_id] || 0)}<span class="etiket ${u.kademe === "PASIF" ? "hata" : u.kademe === "G" || u.kademe === "Y" ? "uyari" : "mor"}">${KADEME[u.kademe] || e(u.kademe)}</span>
      <span class="soluk">${tarih(u.olusturma)}</span>
      ${u.durum === "onaylandi" ? `<span class="etiket ok">Onaylandı (${e(u.karar_veren)}), birazdan gidecek</span>` : ""}</div>
    ${u.kademe === "PASIF" ? '<p class="u-not" style="margin:0 0 10px">Onaylarsan öğretmene bu bildirim gider ve hesabı pasife alınır.</p>' : ""}
    <div class="u-metin-kutu"><b class="u-g-baslik">${e(u.title)}</b><span class="u-g-metin">${e(u.description)}</span></div>
    <div class="u-duzen" hidden><label>Başlık<input class="u-baslik" value="${e(u.title)}" ${u.durum !== "taslak" ? "disabled" : ""}></label>
      <label>Metin<textarea class="u-metin" rows="${Math.min(9, Math.max(3, (u.description || "").split("\n").length + 2))}" ${u.durum !== "taslak" ? "disabled" : ""}>${e(u.description)}</textarea></label></div>
    ${kn.length ? `<div class="u-kanit">Bildirimde geçen sorular: ${kn.map(k => `<button data-k="${e(k)}" title="Soruyu ve cevabı göster">#${e(K[k].sikayet_id ?? K[k].question_id ?? "")}</button>`).join("")}<button class="u-hepsi" style="color:hsl(var(--metin-2))">hepsini aç</button></div><div class="u-kanit-yer"></div>`
      : '<p class="u-not">Bu taslağa soru bağlanmamış (eski kayıt).</p>'}
    <div class="kart-alt">${u.durum === "taslak" ? (u.kademe === "PASIF" && ben.rol !== "yonetici" ? '<span class="soluk">Hesap pasife alma onayını yalnızca yöneticiler verebilir.</span>' : `<button class="birincil u-onay">${u.kademe === "PASIF" ? "Onayla ve pasife al" : "Onayla ve gönder"}</button><button class="ince u-iptal">Gönderme</button><button class="metin-btn u-duzenle">Metni düzenle</button>`) : `<button class="ince u-geri">Onayı geri al</button>`}</div></section>`; };
  const DUR = { gonderildi: ["Gönderildi", "ok"], gonderiliyor: ["Gönderiliyor", "uyari"], iptal: ["Gönderilmedi", ""], hata: ["Hata", "hata"] };
  $("#icerik").innerHTML = baslik("Uyarılar", "Öğretmenlere gidecek bildirimler burada onayını bekler. Metni istersen düzelt, sonra \"Onayla ve gönder\" ya da \"Gönderme\" de. Onayladıktan sonra 30 saniye geri alabilirsin, sonra 1-2 dakika içinde gider. Her taslağın altında bildirimde geçen sorular ve cevaplar görünür. Aşağıda daha önce gönderilen bildirimlerin tamamı var. Öğretmenleri sık bildirimle yormamak için geri bildirim, format hatırlatması ve küçük hatırlatmalar Pazartesi ve Perşembe hazırlanır; bir öğretmenin biriken cevapları tek bildirimde toplanır. Son 3 günde bildirim almış öğretmene yenisi açılmaz, cevapları sonraki güne kalır. Yapay zekâ uyarısı, genel uyarı ve hesap kapatma önerisi beklemez.") + `
    <div class="bilgi-serit"><i data-lucide="moon"></i>Gece 23:00 ile sabah 09:00 arası kimseye bildirim gönderilmez. Bu saatlerde onayladıklarınız sabah 09:00'dan sonra gider.</div>
    <h2>Onay bekleyenler (${acik.length})</h2><p class="aciklama">Metni istersen düzelt, sonra "Onayla ve gönder" de. Onayladıktan sonra 30 saniye geri alabilirsin.</p>
    <div id="u-acik">${acik.length ? acik.map(kart).join("") : '<div class="bos"><b>Onay bekleyen uyarı yok</b>Yeni bildirim taslakları burada onayını bekler.</div>'}</div>
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
    k.querySelector(".u-duzenle")?.addEventListener("click", ev => {
      const d = k.querySelector(".u-duzen"); d.hidden = !d.hidden; k.querySelector(".u-metin-kutu").hidden = !d.hidden;
      ev.target.textContent = d.hidden ? "Metni düzenle" : "Önizlemeye dön";
      if (d.hidden) { k.querySelector(".u-g-baslik").textContent = k.querySelector(".u-baslik").value; k.querySelector(".u-g-metin").textContent = k.querySelector(".u-metin").value; }
    });
    const yer = k.querySelector(".u-kanit-yer");
    const kanitAc = (b, ac) => {
      const v = yer.querySelector(`[data-kk="${CSS.escape(b.dataset.k)}"]`);
      if (!ac && v) { v.remove(); b.classList.remove("acik"); return; }
      if (v) return;
      const d = document.createElement("div"); d.dataset.kk = b.dataset.k; d.innerHTML = sikayetKart(K[b.dataset.k], "goster"); yer.appendChild(d); b.classList.add("acik"); ikon(); klampBagla(d);
    };
    k.querySelectorAll(".u-kanit button[data-k]").forEach(b => b.onclick = () => kanitAc(b, !b.classList.contains("acik")));
    k.querySelector(".u-hepsi")?.addEventListener("click", () => k.querySelectorAll(".u-kanit button[data-k]").forEach(b => kanitAc(b, true)));
    const karar = async onay => {
      if (onay && k.querySelector(".u-baslik:not([disabled])")) {
        const { error } = await sb.rpc("d_uyari_metin", { p_id: id, p_title: k.querySelector(".u-baslik").value, p_description: k.querySelector(".u-metin").value });
        if (error) return bildir("Metin kaydedilemedi: " + error.message);
      }
      const { error } = await sb.rpc("d_uyari_karar", { p_id: id, p_onay: onay, p_beklenen: k.dataset.durum });
      if (error) return bildir(error.message === "sadece_yonetici" ? "Bunu yalnızca yöneticiler onaylayabilir." : error.message === "degisti" ? "Bu uyarıda başka biri karar vermiş; sayfa yenilendi." : "Olmadı: " + error.message), error.message === "degisti" && uyari();
      rozetler(); uyari();
      toast(onay ? "Onaylandı" : "Gönderilmeyecek", onay ? "30 saniye içinde geri alabilirsin, sonra 1-2 dakika içinde gönderilir." : "", async () => {
        const r = await sb.rpc("d_uyari_geri_al", { p_id: id });
        if (r.error) return bildir("Geri alınamadı (gönderim başlamış olabilir).");
        bildir("Geri alındı, yeniden onay bekliyor."); rozetler(); sekme === "uyari" && uyari();
      });
    };
    k.querySelector(".u-onay")?.addEventListener("click", () => { if (k.querySelector(".etiket.hata") && !confirm("Bildirim gidecek ve öğretmenin hesabı pasife alınacak. Emin misin?")) return; karar(true); });
    k.querySelector(".u-iptal")?.addEventListener("click", () => karar(false));
    k.querySelector(".u-geri")?.addEventListener("click", async () => {
      const { error } = await sb.rpc("d_uyari_geri_al", { p_id: id });
      if (error) return bildir("Geri alınamadı (gönderim başlamış olabilir)."); bildir("Onay geri alındı, yeniden onay bekliyor."); rozetler(); uyari();
    });
  });
}
function metinGoster(b, m) {
  let d = $("#metin-dlg"); if (!d) { d = document.createElement("dialog"); d.id = "metin-dlg"; d.className = "metin-dlg"; document.body.appendChild(d); d.onclick = ev => { if (ev.target === d) d.close(); }; }
  d.innerHTML = `<h3>${e(b)}</h3><p>${e(m)}</p><div class="dlg-alt"><button class="ince" onclick="this.closest('dialog').close()">Kapat</button></div>`; d.showModal();
}

// ---------- öğretmenler ----------
const kategori = s => s.kategori || ["diger"];  // kategoriler Mac'te (ortak.py kategori) hesaplanıp kayda yazılır; tek kaynak
async function ogretmen(id) {
  if (id) return ogretmenDetay(+id);
  const [O, U, S7, NU] = await Promise.all([q(sb.from("d_ogretmen").select("*").limit(2000)), q(sb.from("d_uyari").select("ogretmen_id,kademe,durum,gonderim,olusturma,title").order("id")), tumSikayetler(7), uyariSayilari()]);
  const son = {}, bekleyenU = {}, H = {};
  for (const u of U) { if (u.durum === "gonderildi" || u.kademe === "AKTIF") son[u.ogretmen_id] = u; if (u.durum === "taslak" || u.durum === "onaylandi") bekleyenU[u.ogretmen_id] = u; }
  const Q = {};  // öğretmen başına aynı soru tek sayılır, onaylanan varsa o (uyari.py plan() ile aynı)
  for (const s of S7) {
    if (s.tur !== "c" || !s.ogretmen_id || s.durum !== "islendi") continue;
    const k = s.ogretmen_id + ":" + s.question_id;
    if (!Q[k] || (Q[k].son_karar !== "ONAYLA" && s.son_karar === "ONAYLA")) Q[k] = s;
  }
  for (const s of Object.values(Q)) {
    const h = H[s.ogretmen_id] ||= { onay: 0, top: 0, kat: {} }; h.top++;
    if (s.son_karar === "ONAYLA") { h.onay++; for (const k of kategori(s)) h.kat[k] = (h.kat[k] || 0) + 1; }
  }
  const yeniBildirim = o => son[o.id] && Date.now() - new Date(son[o.id].gonderim || son[o.id].olusturma) < 7 * 864e5;
  const esik = o => { const h = H[o.id]; if (!h || o.durum === "pasif") return null;  // UYARI_KURALLAR.md eşikleri (son 7 gün)
    if (h.onay >= 4 && h.onay / h.top >= .5) return "G"; if (h.kat.yapay_zeka) return "Y"; if ((h.kat.dijital_metin || 0) >= 2 || (h.kat.soru_ustune || 0) >= 2) return "F"; return null; };
  const takipGerekli = o => esik(o) && !yeniBildirim(o) && !bekleyenU[o.id];
  const takipDurum = o => {
    const b = bekleyenU[o.id], u = son[o.id];
    if (b) return `<span class="etiket uyari">${KADEME[b.kademe]} onay bekliyor</span>`;
    if (takipGerekli(o)) return `<span class="etiket hata" data-ipucu="Son 7 günde uyarı eşiğini aştı ama bildirim gitmedi.">Takip gerekli</span>`;
    if (u) return `<span class="etiket ${{ PASIF: "hata", AKTIF: "ok", GERI: "mor", F: "mor", KUCUK: "mor", EKSI: "uyari" }[u.kademe] || ""}" data-ipucu="${e(tarih(u.gonderim || u.olusturma))}">${KADEME[u.kademe]}</span>`;
    return '<span class="soluk">—</span>';
  };
  const F = { "": ["Hepsi", () => true], takip: ["Takip gerekli", takipGerekli], sik: ["Sık uyarı alan", o => (NU[o.id] || 0) >= SIK_UYARI], bildirim: ["Bildirim gitti", o => !!son[o.id]], aktif: ["Aktif", o => o.durum !== "pasif"], pasif: ["Pasif", o => o.durum === "pasif"] };
  $("#icerik").innerHTML = baslik("Öğretmenler", "Cevaplarına şikayet gelen öğretmenler. Onay: şikayette öğrenci haklı bulundu. \"Takip gerekli\": son 7 günde uyarı eşiğini aştı ama henüz bildirim gitmedi. \"Sık uyarı\" (turuncu satır): son 30 günde 3 ya da daha fazla uyarı bildirimi gönderildi. Bir satıra tıklayınca öğretmenin bütün şikayetleri ve aldığı bildirimler açılır.") + `
    <div class="cipler" id="o-cip">${Object.entries(F).map(([v, [a, f]]) => `<button class="cip ${v ? "" : "secili"}" data-v="${v}">${a} <small>${O.filter(f).length}</small></button>`).join("")}</div>
    <div class="filtre"><input id="o-ara" placeholder="İsimle ara"><select id="o-sira"><option value="h">Son 7 gündeki onaya göre sırala</option><option value="t">Toplam onaya göre sırala</option></select></div>
    <div class="tablo-sar"><table class="tablo sik" id="o-tablo"></table></div>`;
  let fv = "";
  const ciz = () => {
    const a = $("#o-ara").value.toLocaleLowerCase("tr");
    const S = O.filter(o => F[fv][1](o) && (!a || o.ad.toLocaleLowerCase("tr").includes(a)))
      .sort($("#o-sira").value === "h" ? (x, y) => (H[y.id]?.onay || 0) - (H[x.id]?.onay || 0) || y.onay - x.onay : (x, y) => y.onay - x.onay);
    $("#o-tablo").innerHTML = `<tr><th>Öğretmen</th><th>Durum</th><th>Son 7 gün onay</th><th>Toplam onay / ret</th><th>Onaylanan şikayetlerin sebebi</th><th>Takip / bildirim</th></tr>` +
      (S.map(o => `<tr class="tik${(NU[o.id] || 0) >= SIK_UYARI ? " sik-uyari" : ""}" data-id="${o.id}"><td>${e(o.ad)}${sikEtiket(NU[o.id] || 0)}</td><td><span class="etiket ${o.durum === "pasif" ? "hata" : "ok"}">${o.durum === "pasif" ? "Pasif" : "Aktif"}</span></td>
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
    b: (KADEME[u.kademe] || u.kademe) + (u.durum === "gonderildi" ? " · bildirim gitti" : u.durum === "gonderiliyor" ? " · gönderiliyor" : u.kademe === "AKTIF" ? "" : " · gönderilmedi"), m: u.kademe === "AKTIF" ? (u.description || "") : u.description }));
  T.forEach(x => A.push({ z: x.cevap_tarihi, tur: "takip", renk: sonucRenk(x.sonuc), b: (x.kaynak === "denetim" ? "Rastgele denetim · " : "Yakın takip · ") + sonucAdi("c", x.sonuc), m: `${x.ders || ""} — ${x.gerekce || ""}` }));
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
  $("#icerik").innerHTML = baslik("Tüm şikayetler", "İncelenmiş bütün şikayetlerin listesi. Satıra tıklayınca aynı satırda soru, cevap ve kararın gerekçesi açılır. Öğrenci ve öğretmen adları admin paneldeki profillerine gider. Görseller sadece satırı açınca yüklenir. Kırmızı \"Admin'de kontrol et\" etiketi: karar admin paneline gönderilirken cevap alınamadı ve şikayet artık admin'de bekleyenlerde görünmüyor. Admin panelde o şikayetin sonucuna bakın; doğruysa bir şey yapmayın, yanlışsa admin'de düzeltin.") + `
    <div class="cipler" id="f-tur"><span class="cip-bas">Tür</span><button class="cip secili" data-v="">Hepsi</button><button class="cip" data-v="s">Soru şikayeti</button><button class="cip" data-v="c">Cevap şikayeti</button></div>
    <div class="cipler" id="f-karar"><span class="cip-bas">Sonuç</span><button class="cip secili" data-v="">Hepsi</button><button class="cip" data-v="ONAYLA">Onaylandı</button><button class="cip" data-v="REDDET">Reddedildi</button><button class="cip" data-v="HAVUZA_AKTAR">Derse aktarıldı</button><button class="cip" data-v="bekliyor">Karar bekliyor</button></div>
    <div class="filtre"><input id="f-ara" placeholder="Şikayet no, ders, öğrenci ya da öğretmen adı"></div><div id="f-liste"></div>`;
  let ft = "", fk = "";
  const yukle = async () => {
    let p = sb.from("d_sikayet").select("*").order("olusturma", { ascending: false }).limit(200);
    if (ft) p = p.eq("tur", ft);
    if (fk === "bekliyor") p = p.eq("durum", "bekliyor"); else if (fk) p = p.eq("son_karar", fk);
    const a = $("#f-ara").value.trim().replace(/[,()]/g, " ");
    if (/^\d+$/.test(a)) p = p.eq("sikayet_id", +a); else if (a) { const v = a.replace(/["\\%*]/g, ""); p = p.or(["ders", "ogretmen", "ogrenci"].map(k => `${k}.ilike."*${v}*"`).join(",")); }
    const L = await q(p);
    $("#f-liste").innerHTML = `<div class="tablo-sar"><table class="tablo sik"><tr><th></th><th>Tarih</th><th>Tür</th><th>Ders</th><th>Öğrenci</th><th>Öğretmen</th><th>Sonuç</th></tr>
      ${L.map(s => `<tr class="tik" data-key="${e(s.key)}"><td><span class="ok-ikon">›</span></td><td class="nw">${tarih(s.olusturma)}</td><td class="nw">${s.tur === "s" ? "Soru" : "Cevap"} <span class="soluk">#${s.sikayet_id}</span></td><td>${e(s.ders)}</td>
        <td>${kisiLink(s.ogrenci_seo, s.ogrenci)}</td><td>${kisiLink(s.ogretmen_seo, s.ogretmen)}</td>
        <td>${s.durum === "hata" ? '<span class="etiket hata">Admin\'de kontrol et</span>' : s.durum === "bekliyor" ? '<span class="etiket uyari">Karar bekliyor</span>' : `<span class="etiket ${sonucRenk(s.son_karar)}">${sonucAdi(s.tur, s.son_karar)}</span>`}</td></tr>
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
function basvuruKart(b, kontrol, karar) {
  const hepsi = (b.sorular || []).flatMap(s => [...(s.soru_url || []).slice(0, 1), ...(s.cevap_url || []).slice(0, 1)]);
  let i = 0;
  const grid = (b.sorular || []).map(s => {
    const si = i; i += (s.soru_url || []).slice(0, 1).length; const ci = i; i += (s.cevap_url || []).slice(0, 1).length;
    return `<div class="b-kutu"><div class="ciftm">${s.soru_url?.[0] ? `<div data-galeri="${si}"><img src="${e(s.soru_url[0])}" loading="lazy" alt=""></div>` : "<div></div>"}${s.cevap_url?.[0] ? `<div data-galeri="${ci}"><img src="${e(s.cevap_url[0])}" loading="lazy" alt=""></div>` : "<div></div>"}</div>
      <div class="b-alt"><span><b>${s.no}.</b> <span class="soluk">Doğru ${e((s.dogru_cevap || "?").slice(0, 14))} · aday ${e((s.aday_cevap || "?").slice(0, 8))}</span></span>
      <span class="etiket ${s.dogru_mu === false ? "hata" : s.format_uygun === false ? "uyari" : "ok"}" ${s.not ? `data-ipucu="${e(s.not)}"` : ""}>${s.dogru_mu === false ? "Yanlış" : s.format_uygun === false ? "Format" : "Doğru"}</span></div></div>`;
  }).join("");
  const alt = kontrol ? `<div class="aksiyon"><button class="secim onay" data-v="DOGRU">Karar doğru</button><button class="secim ret" data-v="YANLIS">Karar yanlış</button><input placeholder="Yanlışsa neden? (zorunlu)"><button class="birincil kucuk b-kaydet">Kaydet</button></div>` : "";
  const kararAlt = karar ? `<div class="aksiyon"><button class="secim onay" data-v="ONAYLA">Onayla · solver olsun</button><button class="secim ret" data-v="REDDET">Reddet</button>
      <select class="b-sebep"><option value="">Ret sebebi</option>${Object.entries(SEBEP).map(([k, v]) => `<option value="${k}">${e(v)}</option>`).join("")}</select>
      <input placeholder="Not (isteğe bağlı)"><button class="birincil kucuk b-karar">Kaydet</button></div>` : "";
  const oneri = karar && b.oneri ? `<div class="sk-karar"><div class="sk-karar-satir"><span class="etiket" data-ipucu="İlk değerlendirme emin olamadı; ikinci bakışın önerisi bu.">İkinci bakış: ${b.oneri === "ONAYLA" ? "Onayla" : "Reddet"}</span></div><div class="klamp">${e(b.oneri_gerekce)}</div></div>` : "";
  return `<section class="kart sk" data-bid="${b.id}"><div class="sk-ust"><span class="etiket">Solver başvurusu</span><b>${e(b.ad)}</b><span class="soluk">${e(b.ders)} · ${e(b.basvuru_tarihi)}</span>
    <span class="sag"><a class="soluk" target="_blank" rel="noopener" href="${ADMIN}/SolverApplication/SolverApplicationDetail/${b.id}">admin panelde aç</a>
    ${b.durum === "bekliyor" ? `<span class="etiket uyari">${b.insan_karar ? "Karar verildi, işleniyor" : "Kararınızı bekliyor"}</span>${b.uygulama_notu ? `<span class="etiket hata">${e(b.uygulama_notu)}</span>` : ""}` : `<span class="etiket ${b.karar === "ONAYLA" ? "ok" : "hata"}">${b.karar === "ONAYLA" ? "Onaylandı" : "Reddedildi"}</span>`}${b.durum === "hata" ? '<span class="etiket uyari" data-ipucu="Karar admin paneline 3 denemede işlenemedi. Admin panelde başvuruyu elle onayla ya da reddet.">admin panele işlenemedi</span>' : ""}</span></div>
    <div class="sk-karar"><div class="sk-karar-satir">${karar ? `<span class="etiket">İlk değerlendirme: ${b.karar === "ONAYLA" ? "Onayla" : "Reddet · " + e(b.sebep || "")}</span><span class="etiket uyari">emin değil</span>` : b.karar === "ONAYLA" ? '<span class="etiket ok">6/6 doğru, format uygun</span>' : `<span class="etiket hata">${e(b.sebep)}</span>`}</div><div class="klamp">${e(b.gerekce)}</div></div>${oneri}
    <div class="b-grid" data-medya='${e(JSON.stringify(hepsi))}'>${grid}</div>${alt}${kararAlt}</section>`;
}
function basvuruBagla(yenile) {
  const s0 = sekme;
  document.querySelectorAll("section[data-bid]").forEach(k => {
    let sec = null;
    k.querySelectorAll(".secim").forEach(x => x.onclick = () => { sec = x.dataset.v; k.querySelectorAll(".secim").forEach(y => y.classList.toggle("secili", y === x)); });
    const kb = k.querySelector(".b-karar");
    if (kb) kb.onclick = async () => {
      const id = +k.dataset.bid, sebep = +k.querySelector(".b-sebep").value || null, not = k.querySelector(".aksiyon input").value.trim();
      if (!sec) return bildir("Önce Onayla ya da Reddet seçin."); if (sec === "REDDET" && !sebep) return bildir("Reddederken sebep seçin.");
      kb.disabled = true; const { error } = await sb.rpc("d_basvuru_karar", { p_id: id, p_secim: sec, p_sebep_id: sec === "REDDET" ? sebep : null, p_not: not }); kb.disabled = false;
      if (error) return bildir(error.message === "degistirilemez" ? "Bu başvuru işleniyor ya da artık beklemiyor." : "Kaydedilemedi: " + error.message);
      k.classList.add("gidiyor"); setTimeout(() => k.remove(), 250); rozetler();
      toast("Karar kaydedildi", "30 saniye içinde geri alabilirsiniz, sonra 1-2 dakika içinde admin paneline işlenir.", async () => {
        const r = await sb.rpc("d_basvuru_karar_geri_al", { p_id: id });
        if (r.error) return bildir("Geri alınamadı: süre doldu ya da işlenmeye başladı."); bildir("Geri alındı."); rozetler(); sekme === s0 && yenile && yenile();
      });
    };
    const btn = k.querySelector(".b-kaydet"); if (!btn) return;
    btn.onclick = async () => {
      const not = k.querySelector(".aksiyon input").value.trim(), id = +k.dataset.bid;
      if (!sec) return bildir("Önce seçim yap."); if (sec === "YANLIS" && not.length < 3) return bildir("Yanlış dediysen nedenini yaz.");
      const { error } = await sb.rpc("d_basvuru_kontrol", { p_id: id, p_secim: sec, p_not: not });
      if (error) return bildir("Kaydedilemedi: " + error.message);
      k.classList.add("gidiyor"); setTimeout(() => k.remove(), 250); rozetler();
      toast("Kontrol kaydedildi", "", async () => {
        const r = await sb.rpc("d_basvuru_kontrol_geri_al", { p_id: id });
        if (r.error) return bildir("Geri alınamadı."); bildir("Geri alındı."); rozetler(); sekme === s0 && yenile && yenile();
      });
    };
  });
}
async function basvuru() {
  const H = await q(sb.from("d_basvuru").select("*").order("islem_zamani", { ascending: false }).limit(300));
  const BK = H.filter(b => b.durum === "bekliyor"), L = H.filter(b => b.durum !== "bekliyor");
  const seb = {}; L.filter(b => b.karar !== "ONAYLA").forEach(b => seb[b.sebep] = (seb[b.sebep] || 0) + 1);
  $("#icerik").innerHTML = baslik("Solver başvuruları", "Solver olmak isteyen adaylar 6 test sorusu çözer. 6 sorunun hepsi doğru ve çözümler Solver Kılavuzu'ndaki formata uygunsa aday solver olarak onaylanır, değilse reddedilir. Kararlar otomatik verilir, adaya ayrıca bildirim gitmez. Küçük görsellere tıklayınca büyür; çiplerin üstüne gelince not görünür.") + `
    <div class="cipler" id="b-cip"><button class="cip secili" data-v="">Hepsi <small>${L.length}</small></button><button class="cip" data-v="ONAYLA">Onaylanan <small>${L.filter(b => b.karar === "ONAYLA").length}</small></button>
      ${Object.entries(seb).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<button class="cip" data-v="${e(k)}">${e(k)} <small>${v}</small></button>`).join("")}</div>
    ${BK.length ? `<h2>Kararınızı bekleyenler (${BK.length})</h2><p class="aciklama">İlk değerlendirme bu başvurularda emin olamadı. Görsellere bakıp Onayla ya da Reddet seçin; 30 saniye geri alabilirsiniz, sonra admin paneline işlenir.</p><div id="b-bekleyen" class="b-yer">${BK.map(b => basvuruKart(b, false, !b.insan_karar)).join("")}</div><h2>Sonuçlananlar</h2>` : ""}
    <div class="filtre"><input id="b-ara" placeholder="İsim ya da ders"></div><div id="b-liste"></div>`;
  let fv = "";
  const ciz = () => { const a = $("#b-ara").value.toLocaleLowerCase("tr");
    $("#b-liste").innerHTML = L.filter(b => (!fv || (fv === "ONAYLA" ? b.karar === "ONAYLA" : b.sebep === fv)) && (!a || (b.ad + " " + b.ders).toLocaleLowerCase("tr").includes(a))).map(b => basvuruKart(b, false)).join("") || '<div class="bos">Kayıt yok.</div>';
    klampBagla($("#b-liste")); };
  $("#b-cip").querySelectorAll(".cip").forEach(c => c.onclick = () => { $("#b-cip").querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); fv = c.dataset.v; ciz(); });
  $("#b-ara").oninput = ciz; ciz();
  if (BK.length) { klampBagla($("#b-bekleyen")); basvuruBagla(basvuru); }
}

// ---------- yakın takip ----------
function takipKayit(t) {
  return { key: "t:" + t.key, tur: "c", sikayet_id: t.question_id, question_id: t.question_id, ders: t.ders, ogretmen: t.ogretmen, ogretmen_id: t.ogretmen_id, olusturma: t.cevap_tarihi,
    soru_url: t.soru_url, cevap_url: t.cevap_url, video_url: t.video_url, ajan_karar: t.sonuc, gerekce: t.gerekce, durum: "islendi", son_karar: t.sonuc, kaynak: t.kaynak };
}
async function takip() {
  const [I, T] = await Promise.all([q(sb.from("d_izlenen").select("*").order("baslangic")), q(sb.from("d_takip").select("*").eq("kaynak", "takip").order("cevap_tarihi", { ascending: false }).limit(500))]);
  const S = {}; T.forEach(t => { const s = S[t.ogretmen_id] ||= { TEMIZ: 0, SORUNLU: 0, YZ_KESIN: 0 }; s[t.sonuc]++; });
  $("#icerik").innerHTML = baslik("Yakın takip", "Yapay zekâ kullandığı için hesabı kapatılıp sonra yeniden açılan öğretmenler takip süresi boyunca (tablodaki tarihler) yakından izlenir: şikayet gelmese bile verdikleri her cevap 3 saatte bir kontrol edilir. Yapay zekâ kesin görülürse hesabı kapatma önerisi Uyarılar'a düşer.") + `
    <div class="tablo-sar"><table class="tablo sik"><tr><th>Öğretmen</th><th>Takip süresi</th><th>Kontrol edilen cevap</th><th>Temiz</th><th>Sorunlu</th><th>Yapay zekâ</th></tr>
    ${I.map(o => { const s = S[o.ogretmen_id] || { TEMIZ: 0, SORUNLU: 0, YZ_KESIN: 0 }; return `<tr class="tik" onclick="git('ogretmen','${o.ogretmen_id}')"><td>${e(o.ad)}</td><td class="soluk">${tarih(o.baslangic)} → ${tarih(o.bitis)}</td><td>${s.TEMIZ + s.SORUNLU + s.YZ_KESIN}</td><td>${s.TEMIZ}</td><td>${s.SORUNLU}</td><td><b>${s.YZ_KESIN}</b></td></tr>`; }).join("")}</table></div>
    <h2>Sorunlu bulunan cevaplar</h2>
    ${T.filter(t => t.sonuc !== "TEMIZ").map(t => sikayetKart(takipKayit(t), "goster")).join("") || '<div class="bos">Sorunlu cevap yok.</div>'}`;
}

// ---------- rastgele denetim ----------
async function denetim() {
  const L = await q(sb.from("d_takip").select("*").eq("kaynak", "denetim").order("cevap_tarihi", { ascending: false }).limit(2000));
  const G = {}, O = {};
  L.forEach(x => { const g = x.olusturma ? gunu(x.olusturma) : "", o = G[g] ||= { n: 0, s: 0, y: 0 }; o.n++; if (x.sonuc === "SORUNLU") o.s++; if (x.sonuc === "YZ_KESIN") o.y++;
    const t = O[x.ogretmen_id] ||= { ad: x.ogretmen, n: 0, s: 0, y: 0 }; t.n++; if (x.sonuc === "SORUNLU") t.s++; if (x.sonuc === "YZ_KESIN") t.y++; });
  // genel oran yalnız tamamen rastgele seçilenlerden (riskli gruplar oranı şişirir); eski kayıtlarda seçim türü yok
  const R = L.filter(x => x.secim === "rastgele"), taban = R.length ? R : L.filter(x => !x.secim);
  const top = taban.length, sor = taban.filter(x => x.sonuc !== "TEMIZ").length;
  const GA = { rastgele: "Tamamen rastgele", sikayetli: "Son 7 günde şikayeti onaylanan", denetlenmemis: "14 gündür denetlenmemiş", yeni: "Yeni öğretmen" };
  const grupT = Object.entries(GA).map(([g, ad]) => { const x = L.filter(y => y.secim === g); return x.length ? `<tr><td>${ad}</td><td>${x.length}</td><td>${x.filter(y => y.sonuc !== "TEMIZ").length} (%${Math.round(x.filter(y => y.sonuc !== "TEMIZ").length / x.length * 100)})</td></tr>` : ""; }).join("");
  $("#icerik").innerHTML = baslik("Rastgele denetim", "Şikayet gelmese de her gün son 24 saatte verilen cevaplardan 50 tanesi kontrol edilir: 30'u tamamen rastgele, 20'si riskli gruplardan (şikayeti onaylanan, uzun süredir denetlenmeyen, yeni öğretmenler). Böylece öğrencinin şikayet etmediği kötü cevaplar da görünür. Yapay zekâ kesin görülürse hesabı kapatma önerisi Uyarılar'a düşer.") + `
    <div class="kutular"><div class="kutu"><div class="s">${top}</div><div class="e">denetlenen cevap</div></div>
      <div class="kutu ${top && sor / top > .2 ? "uyari" : ""}"><div class="s">%${top ? Math.round(sor / top * 100) : 0}</div><div class="e">sorunlu oranı (${sor} cevap)</div></div>
      <div class="kutu ${L.some(x => x.sonuc === "YZ_KESIN") ? "hata" : ""}"><div class="s">${L.filter(x => x.sonuc === "YZ_KESIN").length}</div><div class="e">yapay zekâ (kesin)</div></div></div>
    ${grupT ? `<h2>Seçim türüne göre</h2><p class="aciklama">Her gün 30 cevap tamamen rastgele seçilir (üstteki oran bunlardan), 20 cevap riskli gruplardan. Riskli gruplarda oranın yüksek çıkması beklenir.</p><div class="tablo-sar"><table class="tablo sik"><tr><th>Seçim</th><th>Denetlenen</th><th>Sorunlu</th></tr>${grupT}</table></div>` : ""}
    <h2>Gün gün</h2><div class="tablo-sar" id="d-gun"><table class="tablo sik"><tr><th>Gün</th><th>Denetlenen</th><th>Sorunlu</th><th>Yapay zekâ</th></tr>
    ${Object.keys(G).sort().reverse().map(g => `<tr><td>${new Date(g + "T12:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" })}</td><td>${G[g].n}</td><td>${G[g].s}</td><td>${G[g].y}</td></tr>`).join("") || '<tr><td colspan="4" class="soluk">Henüz denetim yapılmadı. İlk denetim bugün içinde çalışacak.</td></tr>'}</table></div>
    <h2>Sorunlu çıkan öğretmenler</h2><div class="tablo-sar"><table class="tablo sik"><tr><th>Öğretmen</th><th>Denetlenen</th><th>Sorunlu</th><th>Yapay zekâ</th></tr>
    ${Object.entries(O).filter(([, o]) => o.s + o.y).sort((a, b) => (b[1].s + b[1].y) - (a[1].s + a[1].y)).map(([id, o]) => `<tr class="tik" onclick="git('ogretmen','${id}')"><td>${e(o.ad)}</td><td>${o.n}</td><td>${o.s}</td><td><b>${o.y}</b></td></tr>`).join("") || '<tr><td colspan="4" class="soluk">Yok.</td></tr>'}</table></div>
    <h2>Sorunlu bulunan cevaplar</h2>${L.filter(x => x.sonuc !== "TEMIZ").slice(0, 40).map(x => sikayetKart(takipKayit(x), "goster")).join("") || '<div class="bos">Sorunlu cevap yok.</div>'}`;
}

// ---------- eksi puanlı solverlar ----------
async function eksi() {
  const [L, NU, GE] = await Promise.all([q(sb.from("d_solver_puan").select("*").order("puan").limit(1000)), uyariSayilari(),
    q(sb.from("d_solver_puan_gecmis").select("solver_id,zaman,puan,onceki,fark,dogru,sikayet,diger,kaynak").gte("zaman", new Date(Date.now() - 7 * 864e5).toISOString()).order("zaman").limit(5000))]);
  const G = {}; GE.forEach(g => (G[g.solver_id] ||= []).push(g));
  // son 7 günün dökümü: doğru cevap +1, onaylanan şikayet −3, kalan "diğer" (soruyu bırakma, süre aşımı ya da elle düzeltme)
  const dokum = id => {
    const R = (G[id] || []).filter(g => g.fark != null); if (!R.length) return '<span class="soluk">—</span>';
    const t = k => R.reduce((a, g) => a + (Number(g[k]) || 0), 0), bilinmeyen = R.filter(g => g.kaynak !== "elle" && g.diger == null).reduce((a, g) => a + Number(g.fark), 0);
    const elle = R.filter(g => g.kaynak === "elle").reduce((a, g) => a + Number(g.fark), 0), diger = R.filter(g => g.kaynak !== "elle").reduce((a, g) => a + (Number(g.diger) || 0), 0);
    const isr = n => (n > 0 ? "+" : "") + n, P = [];
    if (t("dogru")) P.push(`${t("dogru")} doğru cevap (+${t("dogru")})`);
    if (t("sikayet")) P.push(`<span class="etiket hata">${t("sikayet")} onaylı şikayet (−${3 * t("sikayet")})</span>`);
    if (diger) P.push(`<span class="etiket uyari" data-ipucu="Admin panelde kaydı görünmeyen puan değişimi: soruyu bırakma, süre aşımı gibi cezalar.">diğer ${isr(diger)}</span>`);
    if (elle) P.push(`<span class="etiket ok" data-ipucu="Bizim elle yaptığımız düzeltme.">düzeltme ${isr(elle)}</span>`);
    if (bilinmeyen) P.push(`<span class="soluk" data-ipucu="Bu değişimin dökümü henüz çıkarılamadı (ilk okuma).">dökümsüz ${isr(bilinmeyen)}</span>`);
    return P.join(" · ") || '<span class="soluk">—</span>';
  };
  const ek = L.filter(x => x.puan < 0), risk = L.filter(x => x.puan >= 0 && x.puan < 20), son = L.reduce((a, x) => x.son_okuma > a ? x.son_okuma : a, "");
  const satir = x => `<tr class="${(NU[x.id] || 0) >= SIK_UYARI ? "sik-uyari" : ""}"><td>${kisiLink(x.seo, x.ad)}${sikEtiket(NU[x.id] || 0)}</td><td><b>${Number(x.puan)}</b></td><td>${x.onceki_puan ?? "—"}</td><td>${x.son_3gun_cevap ?? ""}</td>
    <td>${dokum(x.id)}</td><td>${x.eksiye_dustu ? tarih(x.eksiye_dustu) : '<span class="soluk">—</span>'}</td><td>${x.bildirim_zamani ? `<span class="etiket ok">Gitti · ${tarih(x.bildirim_zamani)}</span>` : '<span class="soluk">—</span>'}</td></tr>`;
  const bas = `<tr><th>Solver</th><th>Puan</th><th>Önceki okuma</th><th>Son 3 gün cevap</th><th>Son 7 günde puan neden değişti</th><th>Eksiye düştü</th><th>Bildirim</th></tr>`;
  $("#icerik").innerHTML = baslik("Eksi puanlı solverlar", "Puanı eksideki solver çözdüğü sorudan ücret alamaz. Son 3 günde cevap veren solverların puanı okunur: puanı 10'un altında olanlar saatte bir, 10–50 arası günde bir, üstü haftada bir. Puanı 20'nin altında olup cevap vermeyenler de gece bir kez yeniden okunur. \"Son 7 günde puan neden değişti\" sütunu puan değişimini doğru cevap, onaylı şikayet ve diğer (soruyu bırakma, süre aşımı gibi görünmeyen cezalar) olarak ayırır. Puanı artıdan eksiye düşen solvera otomatik kısa bir bildirim gider. Özellikle yeni solverlar ilk günlerde kolay eksiye düşer; listede uzun süre kalan olursa Ulaş'a haber ver.") + `
    <div class="bilgi-serit"><i data-lucide="clock"></i>Son okuma: ${son ? tarih(son) : "—"} · ${L.length} aktif solver</div>
    <h2>Şu an eksi puanda (${ek.length})</h2><div class="tablo-sar" id="e-eksi"><table class="tablo sik">${bas}${ek.map(satir).join("") || '<tr><td colspan="7" class="soluk">Eksi puanlı solver yok.</td></tr>'}</table></div>
    <h2>Risk grubu: puanı 0–19 arası (${risk.length})</h2><p class="aciklama">Bir onaylanan şikayet (−3 puan) ya da bir cezayla eksiye düşebilirler.</p>
    <div class="tablo-sar"><table class="tablo sik">${bas}${risk.map(satir).join("")}</table></div>`;
}

// ---------- uzaklaştırılanların ödemeleri ----------
const tl = n => n == null ? '<span class="soluk">—</span>' : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
async function odeme() {
  if (ben.rol !== "yonetici") { $("#icerik").innerHTML = baslik("Uzaklaştırılanların ödemeleri", "Bu sayfada kimlik ve hesap bilgileri bulunduğu için yalnız yöneticiler görebilir."); return; }
  const L = await q(sb.from("d_odeme").select("*").order("olusturma", { ascending: false }).limit(500));
  const bekleyen = L.filter(x => x.durum === "odenecek"), bilgi = L.filter(x => x.durum === "bilgi_bekleniyor"), biten = L.filter(x => x.durum === "odendi");
  const hazir = bekleyen.filter(x => x.odenecek != null), toplam = hazir.reduce((a, x) => a + Number(x.odenecek), 0);
  const hesap = x => x.iban ? `<div class="od-hesap"><b>${e(x.hesap_sahibi || x.ad)}</b><span>${e(x.iban)}</span><span>TC ${e(x.tc || "—")} · ${e(x.il || "—")}</span>
      <button class="ince kucuk od-kopya" data-metin="${e([x.hesap_sahibi || x.ad, x.iban, x.tc, x.il].filter(Boolean).join("\n"))}">Kopyala</button></div>` : '<span class="soluk">Henüz göndermedi</span>';
  const kesinti = x => x.kesinti == null ? '<span class="etiket uyari" data-ipucu="Sakıncalı cevapların kazancı henüz hesaplanmadı. Hesaplanmadan ödeme yapılmaz.">Hesaplanmadı</span>'
    : `${tl(x.kesinti)}${x.kesinti_notu ? `<div class="soluk kucuk-yazi">${e(x.kesinti_notu)}</div>` : ""}`;
  const islem = x => x.durum === "odendi" ? `<span class="etiket ok">Ödendi · ${tarih(x.odeme_zamani)}</span><button class="ince kucuk od-geri" data-id="${x.id}">Geri al</button>`
    : (x.durum === "odenecek" && x.odenecek != null ? `<button class="birincil kucuk od-odendi" data-id="${x.id}" data-ad="${e(x.ad)}" data-tutar="${tl(x.odenecek)}">Ödendi olarak işaretle</button>`
      : `<span class="soluk">${x.durum === "odenecek" ? "Kesinti hesaplanınca ödenebilir" : "Ödeme bilgisi bekleniyor"}</span>`);
  const satir = x => `<tr><td><b>${e(x.ad)}</b><div class="soluk kucuk-yazi">${e(x.telefon || "")}</div></td><td>${e(x.sebep || "—")}${x.pasif_tarihi ? `<div class="soluk kucuk-yazi">${new Date(x.pasif_tarihi).toLocaleDateString("tr-TR")}</div>` : ""}</td>
    <td>${tl(x.bakiye)}</td><td>${kesinti(x)}</td><td><b>${tl(x.odenecek)}</b></td><td>${hesap(x)}</td><td class="od-islem">${islem(x)}</td></tr>`;
  const bas = `<tr><th>Solver</th><th>Uzaklaştırma nedeni</th><th>Bakiye</th><th>Kesinti</th><th>Ödenecek</th><th>Hesap bilgisi</th><th></th></tr>`;
  const tablo = (R, bos) => `<div class="tablo-sar"><table class="tablo sik">${bas}${R.map(satir).join("") || `<tr><td colspan="7" class="soluk">${bos}</td></tr>`}</table></div>`;
  $("#icerik").innerHTML = baslik("Uzaklaştırılanların ödemeleri", "Hesabı uzaklaştırılan solverın kalan bakiyesi, sakıncalı cevapların kazancı düşüldükten sonra ay sonu ödemesiyle gönderilir. Ödeme bilgisini destek hattı toplar ve buraya işler. Ödemeyi yaptıktan sonra \"Ödendi olarak işaretle\"ye bas; yanlışlıkla bastıysan \"Geri al\" ile düzeltebilirsin.") + `
    <div class="bilgi-serit"><i data-lucide="wallet"></i>Ödemeye hazır ${hazir.length} kişi · toplam ${tl(toplam)}${bekleyen.length - hazir.length ? ` · ${bekleyen.length - hazir.length} kişinin kesintisi hesaplanmadı` : ""}</div>
    <h2>Ödenecekler (${bekleyen.length})</h2>${tablo(bekleyen, "Ödenecek kayıt yok.")}
    <h2>Ödeme bilgisi bekleniyor (${bilgi.length})</h2><p class="aciklama">Destek hattı bu kişilerden ad soyad, IBAN, TC kimlik numarası ve il/ilçe bilgisini istedi; henüz göndermediler.</p>${tablo(bilgi, "Bekleyen yok.")}
    <h2>Ödenenler (${biten.length})</h2>${tablo(biten, "Henüz ödenmiş kayıt yok.")}`;
  $("#icerik").querySelectorAll(".od-kopya").forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.metin); toast("Kopyalandı"); } catch { bildir("Kopyalanamadı; elle seç."); } });
  $("#icerik").querySelectorAll(".od-odendi").forEach(b => b.onclick = async () => {
    if (!confirm(`${b.dataset.ad} için ${b.dataset.tutar.replace(/<[^>]+>/g, "")} ödendi olarak işaretlensin mi?`)) return;
    b.disabled = true; const { error } = await sb.rpc("d_odeme_isaretle", { p_id: Number(b.dataset.id), p_odendi: true });
    if (error) { b.disabled = false; return bildir(error.message === "eksik_bilgi" ? "Tutar ya da hesap bilgisi eksik." : "Hata: " + error.message); }
    toast("Ödendi olarak işaretlendi", b.dataset.ad); rozetler(); odeme().then(() => ikon());
  });
  $("#icerik").querySelectorAll(".od-geri").forEach(b => b.onclick = async () => {
    b.disabled = true; const { error } = await sb.rpc("d_odeme_isaretle", { p_id: Number(b.dataset.id), p_odendi: false });
    if (error) { b.disabled = false; return bildir("Hata: " + error.message); }
    toast("Geri alındı"); rozetler(); odeme().then(() => ikon());
  });
}

// ---------- kapatılmış hesap kesintileri ----------
// Sunucu (kesinti.py) hesabı kapalı ve bakiyesi duran öğretmenin son çekim talebinden sonraki cevaplarını inceler; burada yalnız onay verilir.
const gunAy = t => t ? new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";
async function kesinti() {
  if (ben.rol !== "yonetici") { $("#icerik").innerHTML = baslik("Kapatılmış hesap kesintileri", "Bu sayfayı yalnız yöneticiler görebilir."); return; }
  const L = await q(sb.from("d_kesinti").select("*").order("olusturma", { ascending: false }).limit(500));
  const D = d => L.filter(x => x.durum === d);
  const kutular = x => `<div class="kutular ks-kutular"><div class="kutu"><div class="s">${tl(x.bakiye)}</div><div class="e">bakiye</div></div>
      <div class="kutu"><div class="s">${x.incelenen}</div><div class="e">incelenen cevap</div></div>
      <div class="kutu ${Number(x.kesinti) > 0 ? "uyari" : ""}"><div class="s">${tl(x.kesinti)}</div><div class="e">kesinti</div></div>
      <div class="kutu"><div class="s">${tl(x.odenecek)}</div><div class="e">ödenecek kalan</div></div></div>`;
  const donem = x => `Hesap ${gunAy(x.pasif_tarihi)} tarihinde kapatıldı. ${x.son_cekim ? `Son para çekme talebi ${gunAy(x.son_cekim)}; bu tarihten sonraki ${x.cevap_sayisi} cevaba bakıldı.` : `Hiç para çekme talebi yok; bütün cevaplarına (${x.cevap_sayisi}) bakıldı.`}`;
  const kart = x => `<section class="kart ks" data-id="${x.ogretmen_id}" data-ad="${e(x.ad)}"><div class="ks-ust"><b>${e(x.ad)}</b>${x.durum === "hazir" ? '<span class="etiket uyari">Onay bekliyor</span>' : x.durum === "onaylandi" ? '<span class="etiket">Onaylandı, işleniyor</span>' : x.durum === "uygulandi" ? '<span class="etiket ok">Tamamlandı</span>' : '<span class="etiket hata">Sorun var</span>'}</div>
    <p class="aciklama">${donem(x)}</p>${kutular(x)}
    ${x.durum_notu ? `<p class="ks-not">${e(x.durum_notu)}</p>` : ""}
    ${x.durum === "hazir" ? `<label class="ks-paylasim"><input type="checkbox" class="ks-pay" ${x.hesap_paylasimi ? "checked" : ""}> Hesap paylaşımı var (cevapları başkası yazmış). İşaretlenirse bakiyenin tamamı silinir, ödeme yapılmaz.</label>` : (x.hesap_paylasimi ? '<p class="ks-not">Hesap paylaşımı nedeniyle bakiyenin tamamı silindi.</p>' : "")}
    <details class="ks-cevap"><summary>Cevapları tek tek gör</summary><div class="ks-liste soluk">Yükleniyor…</div></details>
    ${x.durum === "hazir" ? `<div class="ks-alt"><button class="birincil ks-onay">Onayla: ${tl(x.kesinti)} kesilsin, ${tl(x.odenecek)} ödensin</button></div>`
      : x.durum === "uygulandi" ? `<p class="soluk kucuk-yazi">Kesinti ${tarih(x.uygulama_zamani)} tarihinde bakiyeden düşüldü. Kalan tutar <a href="#odeme" onclick="git('odeme');return false">Uzaklaştırılanların Ödemeleri</a> sayfasında.</p>` : ""}</section>`;
  const sade = (R, bos) => `<div class="tablo-sar"><table class="tablo sik"><tr><th>Öğretmen</th><th>Bakiye</th><th>Durum</th></tr>${R.map(x => `<tr><td><b>${e(x.ad)}</b></td><td>${tl(x.bakiye)}</td><td>${e(x.durum_notu || "")}</td></tr>`).join("") || `<tr><td colspan="3" class="soluk">${bos}</td></tr>`}</table></div>`;
  const diger = [...D("acik_hesap"), ...D("bakiye_yok")];
  $("#icerik").innerHTML = baslik("Kapatılmış hesap kesintileri", "Hesabı kapatılan ve bakiyesi duran öğretmenlerin son para çekme talebinden sonraki cevapları incelenir. Hazır metin ya da yapay zekâ çıktısı olan cevapların ücreti bakiyeden kesilir; öğretmenin kendi yazdığı çözüm kesilmez. Yalnız sistemin otomatik değerlendirdiği cevaplar kesilebilir; öğrencinin kendisinin değerlendirdiği cevaplar kesilmez. Sen onaylayınca kesinti bakiyeden düşülür ve kalan tutar ödenecekler listesine eklenir.") + `
    <h2>Onay bekleyenler (${D("hazir").length})</h2>${D("hazir").map(kart).join("") || '<div class="bos">Onay bekleyen kesinti yok.</div>'}
    ${D("onaylandi").length ? `<h2>Onaylandı, işleniyor (${D("onaylandi").length})</h2>${D("onaylandi").map(kart).join("")}` : ""}
    ${D("sorun").length ? `<h2>Sorun çıkanlar (${D("sorun").length})</h2><p class="aciklama">Bu kayıtlarda kesinti uygulanamadı; nedeni kartta yazıyor.</p>${D("sorun").map(kart).join("")}` : ""}
    ${D("inceleniyor").length ? `<h2>İnceleniyor (${D("inceleniyor").length})</h2>${sade(D("inceleniyor"), "")}` : ""}
    <h2>Tamamlananlar (${D("uygulandi").length})</h2>${D("uygulandi").map(kart).join("") || '<div class="bos">Henüz tamamlanan kesinti yok.</div>'}
    ${diger.length ? `<details><summary>İşlem gerekmeyenler (${diger.length})</summary>${sade(diger, "")}</details>` : ""}`;
  const yenile = () => { rozetler(); kesinti().then(() => ikon()); };
  const hata = m => bildir({ degistirilemez: "Bu kayıt artık değiştirilemiyor; sayfayı yenile.", kesilemez: "Bu cevap kesintiye eklenemez: yalnız sistemin otomatik değerlendirdiği, kazanç getirmiş cevaplar kesilebilir.", sadece_yonetici: "Bu işlemi yalnız yöneticiler yapabilir." }[m] || "Hata: " + m);
  $("#icerik").querySelectorAll(".ks").forEach(k => {
    const id = Number(k.dataset.id), x = L.find(y => y.ogretmen_id === id), acik = x.durum === "hazir";
    k.querySelector(".ks-cevap").addEventListener("toggle", async ev => {
      if (!ev.target.open || ev.target.dataset.yuklu) return; ev.target.dataset.yuklu = 1;
      const C = await q(sb.from("d_kesinti_cevap").select("*").eq("ogretmen_id", id).order("cevap_tarihi", { ascending: false }).limit(3000));
      const medya = c => { const M = [...(c.soru_url || []), ...(c.cevap_url || []), ...(c.video_url ? [c.video_url] : [])], ns = (c.soru_url || []).length;
        return M.length ? `<div class="ks-medya" data-medya="${e(JSON.stringify(M))}">${M.map((u, i) => /\.(mp4|mov)(\?|$)/i.test(u) ? `<button class="ince kucuk" data-galeri="${i}">Videoyu aç</button>` : `<figure><img loading="lazy" src="${e(u)}" data-galeri="${i}" alt=""><figcaption>${i < ns ? "Soru" : "Cevap"}</figcaption></figure>`).join("")}</div>` : ""; };
      const satir = c => `<div class="ks-satir"><div class="ks-s-ust"><span><b>${new Date(c.cevap_tarihi).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}</b> · ${e(c.ders || "")} · ${tl(c.tutar)}</span>
          ${acik && c.degerlendiren === "otomatik" && Number(c.tutar) > 0 ? `<label><input type="checkbox" class="ks-tik" data-c="${c.id}" ${c.kesilsin ? "checked" : ""}> Kesintiye dahil</label>` : ""}</div>
        ${c.gerekce ? `<p>${e(c.gerekce)}</p>` : ""}${c.cevap_metni ? `<p class="klamp soluk">${e(c.cevap_metni)}</p>` : ""}${medya(c)}</div>`;
      const kes = C.filter(c => c.kesilsin), temiz = C.filter(c => !c.kesilsin && c.sonuc), ogr = C.filter(c => c.degerlendiren === "ogrenci"), bek = C.filter(c => !c.degerlendiren), sifir = C.filter(c => c.degerlendiren === "otomatik" && !c.sonuc);
      ev.target.querySelector(".ks-liste").classList.remove("soluk");
      ev.target.querySelector(".ks-liste").innerHTML = `<h4>Kesinti sayılan cevaplar (${kes.length})</h4>${kes.map(satir).join("") || '<p class="soluk">Kesinti sayılan cevap yok.</p>'}
        <details><summary>İncelenip kesinti sayılmayan cevaplar (${temiz.length})</summary>${temiz.map(satir).join("") || '<p class="soluk">Yok.</p>'}</details>
        <p class="soluk kucuk-yazi">Kural gereği incelenmeyenler: öğrencinin kendisinin değerlendirdiği ${ogr.length} cevap, henüz değerlendirilmemiş ${bek.length} cevap${sifir.length ? `, kazanç getirmemiş ${sifir.length} cevap` : ""}.</p>`;
      klampBagla(ev.target);
      ev.target.querySelectorAll(".ks-tik").forEach(t => t.onchange = async () => {
        t.disabled = true; const { error } = await sb.rpc("d_kesinti_isaretle", { p_cevap: Number(t.dataset.c), p_kesilsin: t.checked });
        if (error) { t.checked = !t.checked; t.disabled = false; return hata(error.message); }
        toast(t.checked ? "Cevap kesintiye eklendi" : "Cevap kesintiden çıkarıldı", "Tutarlar güncellendi"); yenile();
      });
    });
    const pay = k.querySelector(".ks-pay");
    if (pay) pay.onchange = async () => {
      if (pay.checked && !confirm(`${k.dataset.ad}: hesap paylaşımı işaretlensin mi? Bakiyenin tamamı silinir ve ödeme yapılmaz.`)) { pay.checked = false; return; }
      pay.disabled = true; const { error } = await sb.rpc("d_kesinti_paylasim", { p_ogretmen: id, p_var: pay.checked });
      if (error) { pay.checked = !pay.checked; pay.disabled = false; return hata(error.message); }
      yenile();
    };
    const onay = k.querySelector(".ks-onay");
    if (onay) onay.onclick = async () => {
      const duz = s => String(s).replace(/<[^>]+>/g, "");
      if (!confirm(`${k.dataset.ad}\n\nBakiye: ${duz(tl(x.bakiye))}\nKesilecek: ${duz(tl(x.kesinti))}\nÖdenecek kalan: ${duz(tl(x.odenecek))}\n\nOnaylıyor musun? Kesinti bakiyeden düşülecek.`)) return;
      onay.disabled = true; const { error } = await sb.rpc("d_kesinti_onayla", { p_ogretmen: id, p_onay: true });
      if (error) { onay.disabled = false; return hata(error.message); }
      toast("Kesinti onaylandı", k.dataset.ad, async () => { const g = await sb.rpc("d_kesinti_onayla", { p_ogretmen: id, p_onay: false }); if (g.error) hata(g.error.message); else toast("Onay geri alındı"); yenile(); });
      yenile();
    };
  });
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

// ---------- cevap gönderici (yalnız izleme; veri Mac'teki banka/panel_senk.py'den, 5 dk'da bir) ----------
const GS_ADI = { benzeri_yok: "Bankada benzeri yok", esik_alti: "Benzer ama eşiğin altında", alinamadi: "Başka öğretmen önce aldı", baskasi_cevapladi: "Zaten cevaplanmış",
  okunamadi: "Fotoğraf okunamadı", banka_gorsel_yok: "Bankadaki cevabın görseli yok", video_sinir: "Günlük video sınırı doldu", video_hazirlanamadi: "Video hazırlanamadı",
  video_istiyor: "Video istiyor (video kapalı)", gonderim_hatasi: "Gönderilemedi", zaten_cevapladik: "Bu soruyu zaten cevapladık", yeniden_ai: "Yeniden soruldu → yapay zekâya", coklu_soru: "Fotoğrafta birden çok soru", hata: "Başka sebep" };
const DEG = { yeterli: ["Yeterli", "ok", "Öğrenci yeterli buldu"], yetersiz: ["Yetersiz", "hata", "Öğrenci yetersiz buldu"], otomatik: ["Otomatik onay", "", "Öğrenci değerlendirmedi, sistem süre dolunca otomatik onayladı"],
  bekliyor: ["Bekliyor", "uyari", "Henüz değerlendirme yok"], degerlendirilmedi: ["Değerlendirilmedi", "", "7 günde değerlendirme gelmedi"] };
const yuzde = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
const sayi = n => Number(n || 0).toLocaleString("tr-TR");
let gsYorSek = "bekleyen", gsSebep = "bugun", gsAr = { tur: "7" }, gsV = null, gsGorunum = "banka";
const gunStr = d => d.toLocaleDateString("sv-SE"), gunEkle = (g, n) => gunStr(new Date(new Date(g + "T12:00").getTime() + n * 864e5));
const gkisa = g => new Date(g + "T12:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const tlStr = n => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
// soru başı ödeme: o derste insan öğretmenlere gerçekten ödenen ortalama (en az 10 örnek), yoksa bütün derslerin ortalaması
const dersAnahtar = d => String(d || "Bilinmiyor").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();  // "MATEMATİK (12)" = "Matematik (12)"
// Ders geneli: sınıf/düzey kırılımını at. "TYT Matematik (Mezun)" ve "Matematik (8. Sınıf)" → "Matematik"
const dersGenel = d => (String(d || "Bilinmiyor").replace(/\([^)]*\)/g, "").replace(/^\s*(TYT|AYT|YKS|LGS|KPSS|DGS|ALES|MSÜ)\s+/i, "").replace(/\s+/g, " ").trim() || "Bilinmiyor");
const dersGenelK = d => dersGenel(d).toLocaleLowerCase("tr");
let gsUN = null;
function gsUcret(ders) {
  const U = gsV.Z.ucret || {}, g = U._genel || {};
  if (!gsUN) { gsUN = {}; for (const [k, v] of Object.entries(U)) { if (k === "_genel") continue; const a = gsUN[dersAnahtar(k)] ||= { top: 0, n: 0 }; a.top += v.ort * v.n; a.n += v.n; }
    for (const a of Object.values(gsUN)) a.ort = a.top / a.n; }
  const d = gsUN[dersAnahtar(ders)];
  if (d && d.n >= 10) return { tl: d.ort, n: d.n, kaynak: "ders" };
  if (g.n >= 10) return { tl: g.ort, n: g.n, kaynak: "genel" };
  return { tl: null, n: 0, kaynak: "yok" };
}
const STOPAJ = 0.20;  // öğretmene ödenen tutarın ÜSTÜNE ekstra ödenen gelir vergisi stopajı; gerçek maliyet = ödeme × 1,20
const gsTasarruf = L => L.reduce((a, x) => a + (gsUcret(x.ders).tl || 0), 0) * (1 + STOPAJ);
function gsAralik() {
  const bugun = gunStr(new Date()), ilk = gsV.Z.gunler[0].gun;
  const t = gsAr.tur;
  if (t === "ozel") return [gsAr.bas || ilk, gsAr.son || bugun];
  return { bugun: [bugun, bugun], dun: [gunEkle(bugun, -1), gunEkle(bugun, -1)], 7: [gunEkle(bugun, -6), bugun], 30: [gunEkle(bugun, -29), bugun], hepsi: [ilk, bugun] }[t];
}
async function gonderici() {
  if (ben.rol !== "yonetici") { $("#icerik").innerHTML = baslik("Cevap Gönderici", "Bu sayfayı yalnız yöneticiler görebilir."); return; }
  const [O, C] = await Promise.all([q(sb.from("d_gonderici_ozet").select("k,v,zaman")), q(sb.from("d_gonderici_cevap").select("*").order("zaman", { ascending: false }).limit(5000))]);
  const Z = Object.fromEntries(O.map(x => [x.k, x.v])), senk = O.reduce((a, x) => x.zaman > a ? x.zaman : a, "");
  if (!Z.gunler) { $("#icerik").innerHTML = baslik("Cevap Gönderici", "Henüz veri gelmedi.") + '<div class="bos">Mac\'teki eşitleme ilk kez çalıştığında burası dolar.</div>'; return; }
  gsV = { Z, C }; gsUN = null;
  const H = Z.saglik;
  const dk = H.son_olay ? Math.round((Date.now() - new Date(H.son_olay)) / 6e4) : null, canli = dk != null && dk <= 15 && H.surec >= 2;
  const ob = H.olay_bugun || {}, K = H.kota, V = H.vision, S = H.scaleway;
  const cip = (ok, metin, ipucu) => `<span class="gs-cip ${ok === true ? "ok" : ok === false ? "hata" : ""}" ${ipucu ? `data-ipucu="${e(ipucu)}"` : ""}>${metin}</span>`;
  const serit = `<div class="gs-serit" id="gs-saglik">
    ${canli || !H.planli ? cip(canli, `<b>${canli ? "Çalışıyor" : "Durmuş olabilir"}</b> · son hareket ${dk == null ? "—" : dk < 1 ? "az önce" : dk + " dk önce"}`, canli ? "Gönderici açık ve son 15 dakikada iş yaptı." : "15 dakikadan uzun süredir hareket yok ya da program kapalı. Ulaş'a haber ver.")
      : cip(null, `<b>Planlı durdu</b> · ${e(H.durum_ne || "")} · son hareket ${dk == null ? "—" : dk + " dk önce"}`, "Gönderici bilerek durduruldu, arıza değil.")}
    ${cip((ob.OTURUM_DUSTU || 0) > 4 ? false : null, `Oturum düştü <b>${ob.OTURUM_DUSTU || 0}</b> · kendi girdi <b>${ob.OTO_GIRIS || 0}</b>${ob.OTO_GIRIS_HATA ? ` · giremedi <b>${ob.OTO_GIRIS_HATA}</b>` : ""}`, "Bugün öğretmen hesabından kaç kez çıkış olduğu ve kaçında kendiliğinden yeniden girdiği.")}
    ${cip((ob.BAGLANTI_OLDU || 0) > 3 ? false : null, `Yeniden başladı <b>${ob.BAGLANTI_OLDU || 0}</b>`, "Tarayıcıyla bağlantısı koptuğu için kendini bugün kaç kez yeniden başlattı.")}
    ${cip(K.saat >= K.saat_sinir || K.gun >= K.gun_sinir ? false : null, `Saatlik <b>${K.saat}/${K.saat_sinir}</b> · günlük <b>${K.gun}/${K.gun_sinir}</b> · video <b>${K.video_gun}/${K.video_sinir}</b>`, "Gönderim sınırlarının ne kadarı doldu. Sınır dolunca gönderici bekler.")}
    ${cip(V.calisiyor ? true : null, `Banka yeniden okuma <b>${sayi(V.okunan)}</b> / ${(V.toplam / 1e6).toLocaleString("tr-TR")} M · %${(V.okunan / V.toplam * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}${V.calisiyor ? "" : " · duruyor"}`, "Bankadaki fotoğrafların yeni okuyucuyla baştan okunması. Bitince eşleşme oranı artar.")}
    ${cip(S.sunucu ? true : null, `Kiralık Mac: ${S.sunucu ? S.sunucu + " açık" : S.bekci_acik ? "stok bekleniyor" : "bekçi kapalı"}`, S.son || "")}
    <span class="soluk gs-senk">Güncelleme ${tarih(senk)}</span></div>`;
  $("#icerik").innerHTML = baslik("Cevap Gönderici", "Bankadan otomatik cevap gönderen sistemin durumu. Yalnız izleme; durdurma ve ayar burada yok.") + serit + `
    <div class="gs-sekme" id="gs-sekme"></div>
    <div class="gs-aralik" id="gs-aralik"></div>
    <div id="gs-govde"></div>`;
  gsAralikCiz();
}
function gsAralikCiz() {
  const { Z } = gsV, [bas, son] = gsAralik(), ilk = Z.gunler[0].gun, bugun = gunStr(new Date()), ai = Z.ai || {};
  $("#gs-sekme").innerHTML = [["banka", "Banka cevapları"], ["ai", `Yapay zekâ${ai.calisiyor === false ? " · kapalı" : ""}`]].map(([v, a]) => `<button class="cip ${gsGorunum === v ? "secili" : ""}" data-g="${v}">${a}</button>`).join("");
  $("#gs-sekme").querySelectorAll(".cip").forEach(b => b.onclick = () => { gsGorunum = b.dataset.g; gsAralikCiz(); });
  $("#gs-aralik").innerHTML = `<span class="cipler">${[["bugun", "Bugün"], ["dun", "Dün"], ["7", "Son 7 gün"], ["30", "Son 30 gün"], ["hepsi", "Başından beri"]].map(([v, a]) => `<button class="cip ${gsAr.tur === v ? "secili" : ""}" data-v="${v}">${a}</button>`).join("")}</span>
    <span class="gs-tarihler"><input type="date" id="gs-bas" value="${bas}" min="${ilk}" max="${bugun}"><span>–</span><input type="date" id="gs-son" value="${son}" min="${ilk}" max="${bugun}"></span>`;
  $("#gs-aralik").querySelectorAll(".cip").forEach(b => b.onclick = () => { gsAr = { tur: b.dataset.v }; gsAralikCiz(); });
  ["#gs-bas", "#gs-son"].forEach(s => $(s).onchange = () => { gsAr = { tur: "ozel", bas: $("#gs-bas").value, son: $("#gs-son").value }; if (gsAr.bas > gsAr.son) [gsAr.bas, gsAr.son] = [gsAr.son, gsAr.bas]; gsAralikCiz(); });
  gsCiz(bas, son);
}
function gsCiz(bas, son) {
  const { Z, C } = gsV;
  const G = Z.gunler.filter(g => g.gun >= bas && g.gun <= son), top = k => G.reduce((a, g) => a + (g[k] || 0), 0);
  const Lr = C.filter(x => x.zaman.slice(0, 10) >= bas && x.zaman.slice(0, 10) <= son);
  const ad = bas === son ? gkisa(bas) : `${gkisa(bas)} – ${gkisa(son)}`;
  const kutu = (s, et, ipucu, cls = "") => `<div class="kutu ${cls}" ${ipucu ? `data-ipucu="${e(ipucu)}"` : ""}><div class="s">${s}</div><div class="e">${et}</div></div>`;
  const dsay = (arr, k) => arr.filter(x => x.deg === k).length;
  const gv = $("#gs-govde");
  const bak = top("bakilan"), bankaN = Lr.filter(x => x.banka_id != -1).length, aiN = Lr.filter(x => x.banka_id == -1).length;
  const kaps = bak ? `<div class="gs-kapsama" data-ipucu="Bu aralıkta bakılan soruların ne kadarına cevap gönderildi: bankadan eşleşme ile ve yapay zekâ ile ayrı ayrı. Kalanı ise eşleşme/çözüm bulunamadığı için gönderilemedi.">
    <span class="gs-kaps-bas">${ad} · sorulan <b>${sayi(bak)}</b> soru</span>
    <span class="gs-kaps-p"><b>${yuzde(bankaN, bak)}</b><small>banka · ${sayi(bankaN)}</small></span>
    <span class="gs-kaps-p"><b>${yuzde(aiN, bak)}</b><small>yapay zekâ · ${sayi(aiN)}</small></span>
    <span class="gs-kaps-p gs-kaps-top"><b>${yuzde(bankaN + aiN, bak)}</b><small>toplam kapsama</small></span></div>` : "";
  if (gsGorunum === "ai") {
    const A = Lr.filter(x => x.banka_id == -1), ai = Z.ai || {}, g = (ai.gun || {})[gunStr(new Date())] || {}, ogr = dsay(A, "yeterli") + dsay(A, "yetersiz");
    const sebep = Object.entries(g.sebep || {}).sort((a, b) => b[1] - a[1]);
    const tasA = gsTasarruf(A), olcA = A.filter(x => gsUcret(x.ders).tl != null).length, hs = g.hata_sebep || {};
    const aig = ai.gun || {}, hesap = {};
    Object.keys(aig).forEach(dd => { if (dd >= bas && dd <= son) Object.entries(aig[dd].hesap || {}).forEach(([k, v]) => hesap[k] = (hesap[k] || 0) + v); });
    const hesapStr = Object.entries(hesap).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${e(k)} ${sayi(v)}`).join(" · ");
    gv.innerHTML = kaps + `<p class="gs-acikla">Bankada eşi olmayan fotoğraflı soruları yapay zekâ el yazısıyla çözüp gönderir.${ai.durum_ne ? " Bugünkü ayar: " + e(ai.durum_ne) + "." : ""}${hesapStr ? ` <b>Hesap başına:</b> ${hesapStr}.` : ""}</p>
      <div class="gs-gruplar">
        <div class="gs-grup"><div class="gs-grup-bas">${ad} · yapay zekâ cevapları</div><div class="gs-kutu-sira">
          ${kutu(sayi(A.length), "gönderildi", "Seçilen aralıkta yapay zekânın gönderdiği cevap sayısı.")}
          ${kutu(dsay(A, "yeterli"), "yeterli", "Öğrenci yeterli buldu.", "ok")}
          ${kutu(dsay(A, "yetersiz"), "yetersiz", "Öğrenci yetersiz buldu. Listede en üstte ve kırmızı.", dsay(A, "yetersiz") ? "hata" : "")}
          ${kutu(dsay(A, "bekliyor"), "bekliyor", "Henüz değerlendirme gelmedi.")}
          ${kutu(yuzde(dsay(A, "yeterli"), ogr), "yeterli oranı", "Yalnız öğrencinin verdiği değerlendirmeler.")}
          ${kutu(olcA ? tlStr(tasA) : "—", olcA ? `tasarruf · soru başı ${tlStr(tasA / olcA)}` : "tasarruf · ölçülüyor", "Bu sorular öğretmenlere gitseydi ödenecek gerçek tutar (ortalama ödeme + %20 stopaj). Yapay zekâ, bankanın çözemediği soruları da kapsadığı için ek tasarruf.", "ok")}</div></div>
        <div class="gs-grup"><div class="gs-grup-bas">Bugün</div><div class="gs-kutu-sira">
          ${kutu(g.gon || 0, "gönderildi")}
          ${kutu(g.atla || 0, "atlandı", "Yapay zekânın emin olmayıp geçtiği soru.")}
          ${kutu(g.hata || 0, "hata", Object.keys(hs).length ? "Cevabı gönderirken teknik hata olan denemeler: " + Object.entries(hs).map(([k, n]) => `${k} (${n})`).join(" · ") : "Yapay zekâ çözümü hazırladı ama gönderirken teknik hata oldu (ağ/oturum vb.). Soru tekrar denenir.", g.hata ? "hata" : "")}
          ${Object.keys(ai.hesap_durum || {}).length ? Object.entries(ai.hesap_durum).map(([h, d]) => {
            const acik = (ai.hesap_canli || {})[h] !== false && d.durum != "DURDU" && ai.calisiyor, planli = !acik && d.planli;
            return kutu(acik ? "Açık" : planli ? "Planlı durdu" : "Kapalı", h, planli ? (d.ne || "Bilerek durduruldu, arıza değil.") : acik ? "" : (d.ne || "Beklenmedik şekilde durdu."), acik ? "ok" : planli ? "" : "hata");
          }).join("") : kutu(ai.calisiyor ? "Açık" : "Kapalı", "durum", "", ai.calisiyor ? "ok" : "hata")}</div></div></div>
      ${sebep.length ? `<section class="kart gs-k"><div class="gs-bas"><h3>Bugün neden atladı?</h3></div><p class="gs-acikla">Yapay zekânın çözmeyip geçtiği soruların sebepleri.</p>
        ${sebep.map(([k, n]) => `<div class="gs-sat"><span class="gs-et">${e(k)}</span><b>${n}</b></div>`).join("")}</section>` : ""}
      <section class="kart gs-k"><div class="gs-bas"><h3>Gönderilen yapay zekâ cevapları</h3></div>
        <p class="gs-acikla">${ad}. Satıra tıklayınca soru ile gönderilen cevap yan yana açılır.</p><div id="gs-liste"></div></section>
      <section class="kart gs-k" id="gs-yorumlar"></section>`;
    gsListe(A); gsYorumlarCiz(Z.yorum || {});
    return;
  }
  const B = Lr.filter(x => x.banka_id != -1), ogr = dsay(B, "yeterli") + dsay(B, "yetersiz");
  const tas = gsTasarruf(B), olcul = B.filter(x => gsUcret(x.ders).tl != null).length;
  gv.innerHTML = kaps + `<div class="gs-gruplar">
    <div class="gs-grup"><div class="gs-grup-bas">${ad} · ${G.length} gün</div><div class="gs-kutu-sira">
      ${kutu(sayi(top("bakilan")), "soruya bakıldı")}
      ${kutu(sayi(B.length), `cevap gönderildi · ${B.filter(x => !x.video).length} foto, ${B.filter(x => x.video).length} video`)}
      ${kutu(yuzde(top("gonderilen"), top("bakilan")), "eşleşme oranı", "Bakılan sorulardan kaçına bankadan cevap gönderildi.")}
      ${kutu(olcul ? tlStr(tas) : "—", olcul ? `tasarruf · soru başı ${tlStr(tas / olcul)}` : "tasarruf · ödeme örneği toplanıyor", "Öğretmenlere gitseydi ödenecek gerçek tutar: her cevap kendi dersinde ödenen ortalama + üstüne %20 stopaj." + (olcul < B.length ? ` ${B.length - olcul} cevabın dersinde henüz yeterli örnek yok.` : ""), "ok")}</div></div>
    <div class="gs-grup"><div class="gs-grup-bas">Öğrenci değerlendirmesi</div><div class="gs-kutu-sira">
      ${kutu(dsay(B, "yeterli"), "yeterli", "Öğrenci cevabı yeterli buldu.", "ok")}
      ${kutu(dsay(B, "yetersiz"), "yetersiz", "Öğrenci cevabı yetersiz buldu. Listede en üstte ve kırmızı.", dsay(B, "yetersiz") ? "hata" : "")}
      ${kutu(dsay(B, "bekliyor"), "bekliyor", "Henüz değerlendirme gelmedi; genelde ertesi gün gelir.")}
      ${kutu(dsay(B, "otomatik"), "otomatik onay", "Öğrenci bakmadı, sistem süre dolunca onayladı. Orana katılmaz.")}
      ${kutu(yuzde(dsay(B, "yeterli"), ogr), "yeterli oranı", "Yalnız öğrencinin kendi verdiği değerlendirmeler.")}</div></div></div>
    <section class="kart gs-k gs-tam" id="gs-ders"></section>
    <section class="kart gs-k"><div class="gs-bas"><h3>Gönderilen cevaplar</h3></div>
      <p class="gs-acikla">${ad}. Yetersiz bulunanlar en üstte ve kırmızı. Satıra tıklayınca soru ile cevap yan yana açılır.</p><div id="gs-liste"></div></section>
    <section class="kart gs-k" id="gs-yorumlar"></section>
    <details class="gs-analiz"><summary>Analiz ve grafikler</summary>
      <div class="gs-izgara"><section class="kart gs-k" id="gs-sebep"></section><section class="kart gs-k" id="gs-benz"></section><section class="kart gs-k" id="gs-14"></section><section class="kart gs-k" id="gs-yorum"></section></div></details>`;
  gsDersCiz(B, Z.ders_7 || []);
  gsListe(B);
  gsSebepCiz(Z); gsBenzCiz(Z); gs14Ciz(Z.gunler); gsYorumCiz(Z.yorum || {}); gsYorumlarCiz(Z.yorum || {});
}
function gsSebepCiz(Z) {
  const S = gsSebep === "bugun" ? Z.sebep_bugun : Z.sebep_7, T = {};
  for (const [k, n] of Object.entries(S || {})) { const [s, t] = k.split("|"); (T[s] ||= { f: 0, v: 0 })[t] += n; }
  const L = Object.entries(T).map(([s, o]) => ({ s, ...o, n: o.f + o.v })).sort((a, b) => b.n - a.n), mx = Math.max(1, ...L.map(x => x.n)), top = L.reduce((a, x) => a + x.n, 0);
  $("#gs-sebep").innerHTML = `<div class="gs-bas"><h3>Neden atlandı?</h3><span class="cipler">${[["bugun", "Bugün"], ["7", "7 gün"]].map(([v, a]) => `<button class="cip ${gsSebep === v ? "secili" : ""}" data-v="${v}">${a}</button>`).join("")}</span></div>
    <p class="gs-acikla">Gönderilmeyen soruların sebebi. En uzun çubuk en çok soru kaçıran sebep.</p><div class="gs-lejant"><span><i class="gs-r foto"></i>fotoğraf isteyen</span><span><i class="gs-r video"></i>video isteyen</span><span class="soluk">toplam ${sayi(top)}</span></div>
    ${L.length ? L.map(x => `<div class="gs-sat" data-ipucu="${e(GS_ADI[x.s] || x.s)}: ${x.f} fotoğraf, ${x.v} video sorusu">
      <span class="gs-et">${e(GS_ADI[x.s] || x.s)}</span><span class="gs-cub"><span class="foto" style="width:${x.f / mx * 100}%"></span><span class="video" style="width:${x.v / mx * 100}%"></span></span><b>${x.n}</b><span class="soluk gs-y">${yuzde(x.n, top)}</span></div>`).join("") : '<p class="soluk">Atlanan soru yok.</p>'}`;
  $("#gs-sebep").querySelectorAll(".cip").forEach(b => b.onclick = () => { gsSebep = b.dataset.v; gsSebepCiz(Z); });
}
function gsBenzCiz(Z) {
  const H = Z.benzerlik_7 || {}, es = H.esik || .82, al = H.esik_alti || {};
  const kova = []; for (let v = 30; v < 100; v += 2) kova.push((v / 100).toFixed(2));
  const g = k => (H.gonderilen || {})[k] || 0, x = k => (H.eslesmeyen || {})[k] || 0, mx = Math.max(1, ...kova.map(k => g(k) + x(k)));
  const W = 100 / kova.length, ey = 150;
  const bar = kova.map((k, i) => { const hx = x(k) / mx * ey, hg = g(k) / mx * ey;
    return `<g><title>${k.replace(".", ",")}–${(+k + .02).toFixed(2).replace(".", ",")}: ${g(k)} gönderilen, ${x(k)} eşleşmeyen</title>
      ${hx ? `<rect x="${i * W + .3}%" y="${ey - hx}" width="${W - .6}%" height="${hx}" rx="2" class="gs-es"/>` : ""}${hg ? `<rect x="${i * W + .3}%" y="${ey - hx - hg - (hx ? 1 : 0)}" width="${W - .6}%" height="${hg}" rx="2" class="gs-gon"/>` : ""}
      <rect x="${i * W}%" y="0" width="${W}%" height="${ey}" fill="transparent"/></g>`; }).join("");
  const ex = (es - .30) / .70 * 100;
  $("#gs-benz").innerHTML = `<div class="gs-bas"><h3>Eşleşme kalitesi · 7 gün</h3></div>
    <p class="gs-acikla">Soru bankadakine ne kadar benziyor (1 = aynı soru). Kırmızı çizginin sağındakiler gönderilir.</p><div class="gs-lejant"><span><i class="gs-r foto"></i>gönderilen</span><span><i class="gs-r es"></i>eşleşmeyenin en yakın benzeri</span></div>
    <svg class="gs-svg" viewBox="0 0 100 ${ey + 16}" preserveAspectRatio="none" height="${ey + 16}" width="100%">${bar}
      <line x1="${ex}%" x2="${ex}%" y1="0" y2="${ey}" class="gs-esik"/><line x1="0" x2="100%" y1="${ey}" y2="${ey}" class="gs-taban"/></svg>
    <div class="gs-eks"><span>0,30</span><span style="left:${(.5 - .3) / .7 * 100}%">0,50</span><span style="left:${(.7 - .3) / .7 * 100}%">0,70</span><span class="gs-eks-esik" style="left:${ex}%">eşik ${String(es).replace(".", ",")}</span></div>
    <p class="gs-not" data-ipucu="Bu sorular bankadakine çok benziyor ama eşiğin altında kaldığı için gönderilmedi. Eşik düşürülürse bunlar da gönderilir; ama yanlış soru eşleşmesi riski artar.">Eşiğin hemen altında (0,75–${String(es).replace(".", ",")}): <b>${al.bugun || 0}</b> bugün · <b>${al.son7 || 0}</b> son 7 günde</p>`;
}
function gs14Ciz(T) {
  const G = T.slice(-14), C = gsV.C, gk = gkisa;
  const kucuk = (ad, f, ozet, bic) => { const v = G.map(f), mx = Math.max(1, ...v.filter(x => x != null));
    return `<div class="gs-mini"><div class="gs-mini-bas"><span>${ad}</span><b>${ozet == null ? "—" : bic(ozet)}</b></div>
      <div class="gs-cubuklar">${v.map((x, i) => `<span data-ipucu="${gk(G[i].gun)}: ${x == null ? "veri yok" : bic(x)}" style="height:${x == null ? 0 : Math.max(2, x / mx * 100)}%" class="${x == null ? "gs-yok" : ""}"></span>`).join("")}</div>
      <div class="gs-mini-alt"><span>${gk(G[0].gun)}</span><span>bugün</span></div></div>`; };
  const top = k => G.reduce((a, g) => a + (g[k] || 0), 0), oran = (a, b) => b ? a / b * 100 : null, yz = x => "%" + Math.round(x);
  const tg = g => gsTasarruf(C.filter(x => x.zaman.slice(0, 10) === g.gun));
  $("#gs-14").innerHTML = `<div class="gs-bas"><h3>Son 14 gün</h3></div><p class="gs-acikla">Her çubuk bir gün, en sağdaki bugün; üstüne gelince o günün değeri çıkar. Sağdaki sayı 14 günün toplamı ya da ortalaması.</p><div class="gs-minis">
    ${kucuk("Gönderilen cevap · toplam", g => g.gonderilen || 0, top("gonderilen"), sayi)}
    ${kucuk("Eşleşme oranı · ortalama", g => oran(g.gonderilen || 0, g.bakilan), oran(top("gonderilen"), top("bakilan")), yz)}
    ${kucuk("Yeterli oranı · ortalama", g => oran(g.yeterli || 0, (g.yeterli || 0) + (g.yetersiz || 0)), oran(top("yeterli"), top("yeterli") + top("yetersiz")), yz)}
    ${kucuk("Tasarruf · toplam", tg, G.reduce((a, g) => a + tg(g), 0), x => sayi(Math.round(x)) + " TL")}</div>`;
}
function gsDersCiz(L, D7) {
  const R = {};
  const yaz = d => /[a-zçğıöşü]/.test(d || "") ? d : null;   // tamamı büyük harf yazılmış eski adı göstermemek için
  for (const x of L) { const k = dersGenelK(x.ders), ad = dersGenel(x.ders), r = R[k] ||= { ders: ad, gon: 0, yeterli: 0, yetersiz: 0, odeme: 0, odeme_n: 0 }; if (yaz(ad) && !yaz(r.ders)) r.ders = ad; r.gon++; if (x.deg === "yeterli" || x.deg === "yetersiz") r[x.deg]++; const t = gsUcret(x.ders).tl; if (t != null) { r.odeme += t; r.odeme_n++; } }
  const E = {}; for (const x of D7) { const a = E[dersGenelK(x.ders)] ||= { ornek: 0, ornek_gon: 0, ders: dersGenel(x.ders) }; a.ornek += x.ornek || 0; a.ornek_gon += x.ornek_gon || 0; }
  for (const k in E) { if (!R[k] && E[k].ornek >= 9) R[k] = { ders: E[k].ders, gon: 0, yeterli: 0, yetersiz: 0, odeme: 0, odeme_n: 0 }; }
  const S = Object.values(R).sort((a, b) => b.gon - a.gon || (E[dersGenelK(b.ders)]?.ornek || 0) - (E[dersGenelK(a.ders)]?.ornek || 0)).slice(0, 12);
  const g = (gsV.Z.ucret || {})._genel || {};
  $("#gs-ders").innerHTML = `<div class="gs-bas"><h3>Ders bazında tasarruf</h3></div><p class="gs-acikla">Seçilen aralıkta her derste kaç cevap gitti ve öğretmene gitseydi ne ödenecekti. Dersler sınıf ayrımı olmadan geneldir (ör. TYT, mezun, 8. sınıf hepsi tek "Matematik"). Soru başı ödeme, o dersin cevaplarında öğretmenlere gerçekten ödenen tutarların ortalaması. Tasarruf, bu ödemenin üstüne %20 stopaj eklenmiş gerçek maliyettir.</p>
    ${S.length ? `<table class="tablo sik gs-tablo"><tr><th>Ders</th><th>Gönderilen</th><th data-ipucu="Bu dersin cevaplarında öğretmenlere ödenen gerçek kazancın ortalaması. Stopaj hariç, öğretmenin eline geçen.">Soru başı ödeme</th><th data-ipucu="Soru başı ödeme × gönderilen × 1,20 (üstüne %20 stopaj dahil).">Tasarruf</th><th>Yeterli / yetersiz</th><th data-ipucu="Son 7 günde bu dersten bakılan soruların yüzde kaçına cevap gönderilebildi (üçte bir örnekle).">Eşleşme · 7 gün</th></tr>
    ${S.map(x => { const sb = x.odeme_n ? x.odeme / x.odeme_n : null, ek = E[dersGenelK(x.ders)], o = ek?.ornek >= 9 ? ek.ornek_gon / ek.ornek : null, zayif = o != null && o < .05;
      return `<tr class="${zayif ? "gs-zayif" : ""}"><td title="${e(x.ders)}">${e(x.ders)}</td><td>${x.gon}</td>
        <td>${sb == null ? '<span class="soluk">ölçülüyor</span>' : `${tlStr(sb)} <span class="soluk">(${x.odeme_n} cevap)</span>`}</td>
        <td><b>${sb == null ? "—" : tlStr(x.odeme * (1 + STOPAJ))}</b></td><td>${x.yeterli} / ${x.yetersiz ? `<b class="gs-kirmizi">${x.yetersiz}</b>` : 0}</td><td>${o == null ? "—" : "%" + Math.round(o * 100)}</td></tr>`; }).join("")}</table>
    <p class="soluk gs-dip">Genel ortalama ${g.ort ? tlStr(g.ort) + ` (${g.n} örnek)` : "henüz ölçülüyor"}. Ödeme örnekleri her saat birkaç düzine artıyor; ilk gün bazı derslerde "ölçülüyor" görünür. Turuncu satır: bankanın zayıf kaldığı ders (eşleşme %5'in altında).</p>` : '<p class="soluk">Bu aralıkta gönderilen cevap yok.</p>'}`;
}
// 24 Eki: öğrenci yorumlarına yazdığımız yanıtlar. Bekleyen = gönderici kuyruğu (dakikada 1 gider), gönderilen = gitmiş yanıtlar.
function gsYorumlarCiz(Y) {
  const yer = $("#gs-yorumlar"); if (!yer) return;
  const K = Y.kuyruk || [], G = Y.gonderilen || [], L = gsYorSek === "bekleyen" ? K : G;
  const sat = y => `<div class="gs-ys"><div class="soluk gs-ys-bas">${soruLink(y.soru, "Soru " + y.soru)}${y.ders ? " · " + e(y.ders) : ""}${y.hesap ? ` · <span class="etiket">${e(y.hesap)}</span>` : ""}${y.zaman ? " · " + tarih(y.zaman) : ""}</div>
    <div class="gs-yor"><span class="soluk">Öğrenci${y.ogrenci_zaman ? " · " + tarih(y.ogrenci_zaman) : ""}</span><div class="klamp">${y.ogrenci ? e(y.ogrenci) : '<span class="soluk">yorum metni henüz gelmedi</span>'}</div></div>
    <div class="gs-yor biz"><span class="soluk">${gsYorSek === "bekleyen" ? "Gönderilecek yanıt" : "Gönderdiğimiz yanıt"}</span><div class="klamp">${e(y.yanit)}</div></div></div>`;
  yer.innerHTML = `<div class="gs-bas"><h3>Yorum yanıtları</h3><span class="cipler">${[["bekleyen", `Bekleyen ${Y.kuyruk_n ?? K.length}`], ["gonderilen", `Gönderilen · bugün ${Y.gonderilen_bugun || 0}`]].map(([v, a]) => `<button class="cip ${gsYorSek === v ? "secili" : ""}" data-v="${v}">${a}</button>`).join("")}</span></div>
    <p class="gs-acikla">${gsYorSek === "bekleyen" ? "Öğrenci yorumlarına yazılan, henüz gitmemiş yanıtlar. Gönderici dakikada bir yanıt gönderir. Yanıtı yalnız soruyu cevaplayan hesap gönderebilir." : "Öğrencilere gönderdiğimiz son yanıtlar, en yenisi üstte."} Metne tıklayınca tamamı açılır.</p>
    ${L.length ? L.slice(0, 40).map(sat).join("") : `<p class="soluk">${gsYorSek === "bekleyen" ? "Bekleyen yanıt yok." : "Henüz gönderilen yanıt yok."}</p>`}`;
  yer.querySelectorAll(".cip").forEach(b => b.onclick = () => { gsYorSek = b.dataset.v; gsYorumlarCiz(Y); });
  yer.querySelectorAll(".klamp").forEach(k => k.onclick = () => k.classList.toggle("acik"));
}
function gsYorumCiz(Y) {
  const L = (Y.son || []).slice(0, 6);
  $("#gs-yorum").innerHTML = `<div class="gs-bas"><h3>Öğrenci yorumları</h3></div><p class="gs-acikla">Gelen <b>${Y.gelen || 0}</b> yorum, verilen <b>${Y.yanit || 0}</b> yanıt · bugün ${Y.gelen_bugun || 0} yorum, ${Y.yanit_bugun || 0} yanıt</p>
    ${L.length ? L.map(y => `<div class="gs-yor ${y.kim}"><span class="soluk">${tarih(y.zaman)} · ${y.kim === "biz" ? "bizim yanıt" : "öğrenci"} · ${soruLink(y.soru, "soru " + y.soru)}</span><div class="klamp">${e(y.metin)}</div></div>`).join("") : '<p class="soluk">Henüz yorum yok.</p>'}`;
}
function gsListe(C, n = 15) {
  const K = gsV.Z.kontrol || {}, KNT = { banka_yanlis: ["Cevabımız yanlıştı", "gs-knt-k"], cevap_dogru: ["Cevabımız doğru", "gs-knt-y"], belirsiz: ["Belirsiz", "gs-knt-n"] };
  const kntRoz = id => { const k = K[id]; if (!k) return ""; const m = KNT[k.karar] || [k.karar, "gs-knt-n"]; return ` <span class="etiket ${m[1]}" data-ipucu="Senin kontrolün: ${e(k.aciklama)}">${m[0]}</span>`; };
  const sira = { yetersiz: 0 }, T = [...C].sort((a, b) => (sira[a.deg] ?? 1) - (sira[b.deg] ?? 1) || (a.zaman < b.zaman ? 1 : -1)), L = T.slice(0, n);
  $("#gs-liste").innerHTML = L.length ? `<table class="tablo sik gs-liste-t"><tr><th>Saat</th><th>Soru</th><th>Ders</th><th>Benzerlik</th><th>Tür</th><th>Değerlendirme</th><th></th></tr>
    ${L.map(x => { const d = DEG[x.deg] || [x.deg, ""];
      return `<tr class="tik ${x.deg === "yetersiz" ? "gs-yetersiz" : ""}" data-id="${x.soru_id}"><td class="nw">${tarih(x.zaman)}</td><td>${soruLink(x.soru_id, x.soru_id)}</td><td>${e(x.ders || "—")}</td>
        <td>${x.benzerlik == null ? "—" : Number(x.benzerlik).toFixed(2).replace(".", ",")}</td><td>${x.video ? "Video" : "Fotoğraf"}${x.banka_id == -1 ? ' <span class="etiket" data-ipucu="Bankadan değil, yapay zekânın el yazısıyla hazırladığı cevap.">Yapay zekâ</span>' : ""}</td>
        <td><span class="etiket ${d[1]}" ${x.deg_metin || d[2] ? `data-ipucu="${e(x.deg_metin || d[2])}"` : ""}>${d[0]}</span>${kntRoz(x.soru_id)}</td><td><span class="ok-ikon">›</span></td></tr>`; }).join("")}</table>${T.length > n ? `<button class="gs-daha">Tümünü göster (${T.length})</button>` : ""}` : '<div class="bos">Bu aralıkta gönderilen cevap yok.</div>';
  const d = $("#gs-liste .gs-daha"); if (d) d.onclick = ev => { ev.stopPropagation(); gsListe(C, 500); };
  $("#gs-liste").onclick = ev => {
    if (ev.target.closest("a")) return;
    const tr = ev.target.closest("tr.tik"); if (!tr) return;
    const ac = tr.nextElementSibling?.classList.contains("acilir"); tr.parentElement.querySelectorAll("tr.acilir").forEach(r => r.remove()); tr.parentElement.querySelectorAll("tr.acik-satir").forEach(r => r.classList.remove("acik-satir"));
    if (ac) return;
    const x = C.find(c => c.soru_id == tr.dataset.id), vid = x.video ? x.cevap_foto[0] : null;
    tr.classList.add("acik-satir");
    tr.insertAdjacentHTML("afterend", `<tr class="acilir"><td colspan="7"><div class="gs-acik">${medya(x.soru_foto, vid ? [] : x.cevap_foto, vid, x.banka_id == -1 ? "Gönderilen cevap (yapay zekâ)" : "Gönderilen cevap")}
      <div class="soluk">${[x.unite, x.konu].filter(Boolean).map(e).join(" › ")}${x.sik ? ` · şık <b>${e(x.sik)}</b>` : ""}${x.deg_metin ? ` · ${e(x.deg_metin)}` : ""}${x.soru_foto.length ? "" : " · öğrencinin fotoğrafı henüz çekilmedi"}</div>
      ${K[x.soru_id] ? `<div class="gs-knt-kutu ${(KNT[K[x.soru_id].karar] || [])[1] || "gs-knt-n"}"><b>Kontrol — ${(KNT[K[x.soru_id].karar] || [K[x.soru_id].karar])[0]}:</b> ${e(K[x.soru_id].aciklama)}</div>` : ""}
      ${(x.yorumlar || []).length ? x.yorumlar.map(y => `<div class="gs-yor ${y.kim}"><span class="soluk">${y.kim === "biz" ? "Bizim yanıt" : "Öğrenci"} · ${tarih(y.zaman)}</span><div>${e(y.metin)}</div></div>`).join("") : ""}</div></td></tr>`);
  };
}

// ---------- kullanım rehberi (? düğmesi) ----------
const REHBER = {
  ozet: [["#oz-kontrol", "Son otomatik kontrol", "Şikayetler 20 dakikada bir otomatik incelenir. Bu süre 50 dakikayı geçerse kutu turuncu olur; Ulaş'a haber ver."],
    ["#oz-baglanti", "Admin paneli bağlantısı", "Kararların admin paneline işlenebilmesi için bağlantı gerekir. \"Kopuk\" görürsen kararlar bağlantı gelene kadar sırada bekler."],
    ["#oz-dogruluk", "Otomatik karar doğruluğu", "Haftalık kontrolde \"Karar doğru\" dediğin kararların oranı. %90'ın altına düşerse kutu turuncu olur; o zaman kuralları birlikte gözden geçiririz."],
    ["#oz-bekleyen", "Kararını bekleyen", "Otomatik incelemenin emin olamadığı ve senin kararını bekleyen şikayetler. Sol menüden Şikayetler › Kararını Bekleyenler'e git."],
    ["#oz-kontroller", "Son otomatik kontroller", "Her kontrolde kaç şikayet incelendi ve nasıl sonuçlandı. \"Neler oldu\"ya tıklayınca tek tek görürsün."]],
  haftalik: [["#h-sikayet", "Şikayet özeti", "Son 7 günün sayıları; parantez içinde önceki haftanınki. Onaylananlar hızla artıyorsa öğretmenlere geri bildirimleri sıklaştırmak gerekir."]],
  gunluk: [["#gn-kutular", "30 günün toplamı", "Toplam şikayet ve bunların kaçının onaylandığı, reddedildiği, doğru derse aktarıldığı."], ["#gn-tablo", "Gün gün", "Her satır bir gün. Sağdaki çubuk o günün yoğunluğunu gösterir."]],
  bekleyen: [["section.sk .sk-kisiler", "Kimler", "Öğrenci ve öğretmen adına tıklayınca admin paneldeki profili açılır. \"Soruyu admin panelde aç\" sorunun sayfasına gider."],
    ["section.sk .sk-bilgi", "Öğrencinin şikayeti", "Öğrencinin neden şikayet ettiği ve yazdığı not. Kararı verirken önce buna bak."],
    ["section.sk .medya", "Soru ve cevap", "Solda soru, sağda öğretmenin cevabı. Görsele tıklayınca büyür, oklarla diğer görsellere geçersin."],
    ["section.sk .sk-karar", "Otomatik incelemenin görüşü", "İlk incelemenin önerisi ve gerekçesi. \"Emin değil\" yazıyorsa karar senin. \"İkinci kontrol\" varsa kayda ikinci kez bakılmıştır."],
    ["section.sk .aksiyon", "Kararın", "Cevap şikayetinde Onayla = öğrenci haklı (öğretmen ücret alamaz), Reddet = öğretmen haklı. Soru şikayetinde Onayla = soru kaldırılır. İstersen not yaz, Kaydet'e bas. 30 saniye içinde sağ alttan geri alabilirsin."]],
  kontrol: [[".bilgi-serit", "Bu haftanın ilerlemesi", "Kaç kararı kontrol ettiğin."], ["section.sk .sk-karar", "Verilen karar", "Otomatik incelemenin verdiği karar ve gerekçesi. Görsellere bakıp katılıp katılmadığına karar ver."],
    ["section.sk .aksiyon", "Doğru mu?", "Katılıyorsan \"Karar doğru\". Katılmıyorsan \"Karar yanlış\" seç ve nedenini yaz; bu not kurallara eklenir. Yanlış kararı admin panelinde ayrıca elle düzeltmen gerekir."]],
  uyari: [["#u-acik", "Onay bekleyen bildirimler", "Kurallara göre hazırlanmış bildirimler. Metni düzeltebilirsin. \"Onayla ve gönder\" 30 saniyelik geri alma süresinden sonra gönderir, \"Gönderme\" iptal eder. \"Hesabı pasife alma\" onaylanırsa öğretmenin hesabı kapanır."],
    ["#u-dur", "Hızlı filtre", "Gönderilen bildirimleri duruma ve türe göre süz."], ["#u-tablo", "Geçmiş", "Metnin tamamını görmek için metne tıkla. Durum çipinin üstüne gelince varsa açıklaması görünür."]],
  ogretmen: [["#o-cip", "Hızlı filtre", "\"Takip gerekli\": uyarı eşiğini aşmış ama bildirim almamış öğretmenler; önce bunlara bak."], ["#o-tablo", "Liste", "Bir satıra tıklayınca öğretmenin bütün şikayetleri ve aldığı bildirimler açılır."]],
  sikayet: [["#f-tur", "Filtreler", "Türe ve sonuca göre süz, altta ada ya da şikayet numarasına göre ara."], ["#f-liste", "Liste", "Satıra tıklayınca aynı satırda detay açılır. Öğrenci/öğretmen adları admin paneldeki profile gider."]],
  basvuru: [["#b-cip", "Filtreler", "Onaylananlar ya da ret sebebine göre süz."], ["section.sk .b-grid", "6 test sorusu", "Her kutuda solda soru, sağda adayın çözümü. Tıklayınca büyür. Çipin üstüne gelince not görünür."]],
  takip: [[".tablo-sar", "İzlenen öğretmenler", "Kaç cevabının kontrol edildiği ve sonuçları. Satıra tıklayınca öğretmenin sayfası açılır."]],
  eksi: [["#e-eksi", "Eksidekiler", "Bu solverlar şu an soru başına ücret alamıyor. Bildirim sütunu, eksiye düştüğünde otomatik bildirimin gidip gitmediğini gösterir."]],
  gonderici: [["#gs-saglik", "Sağlık şeridi", "Kırmızı bir şey varsa gönderici takılmış olabilir; Ulaş'a haber ver. Üstüne gelince her birinin açıklaması çıkar."],
    ["#gs-sekme", "Banka / Yapay zekâ", "İki ayrı görünüm: bankadan eşleşen cevaplar ve yapay zekânın yazdığı cevaplar. Sayılar ayrı tutulur, karışmaz."],
    ["#gs-aralik", "Tarih aralığı", "Hazır aralıklardan birini seç ya da iki tarihi kendin gir. Kartlar, ders tablosu ve cevap listesi bu aralığa göre değişir."],
    ["#gs-ders", "Ders bazında tasarruf", "Her derste öğretmenlere ödenen ortalama farklı; tasarruf her ders kendi ortalamasıyla hesaplanır."],
    ["#gs-liste", "Gönderilen cevaplar", "Yetersiz bulunanlar en üstte ve kırmızı. Satıra tıklayınca soru ile gönderilen cevap yan yana açılır."],
    [".gs-analiz", "Analiz ve grafikler", "Üstüne tıklayınca açılır: neden atlandığı, eşleşme kalitesi, son 14 gün ve öğrenci yorumları. Günlük bakışta kapalı durur, kalabalık etmez."]],
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
  kutu.innerHTML = `<h4>${e(b)}</h4><p>${e(m)}</p><div class="r-alt"><span>${rAd + 1} / ${rL.length}</span><span style="display:flex;gap:6px">
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
