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
const baslik = b => `<div class="ust-cubuk"><div><h2>${b}</h2></div></div>`;
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
const ADLAR = { bugun: "Bugün", rapor: "Rapor", bekleyen: "Kararını bekleyenler", kontrol: "Haftalık kontrol", uyari: "Uyarılar", ogretmen: "Öğretmenler", sikayet: "Tüm şikayetler",
  basvuru: "Solver başvuruları", takip: "Yakın takip", ogrenci: "Öğrenciler", eksi: "Eksi puanlılar", denetim: "Rastgele denetim", odeme: "Ödemeler", kesinti: "Hesap kesintileri", gonderici: "Tebeşir", sure: "Tebeşir · Süreler", daha: "Daha fazla" };
function git(s, alt) {
  if (s === "gunluk" || s === "haftalik") s = "rapor";
  if (s === "ozet") s = "bugun";
  sekme = s; location.hash = alt ? `${s}/${alt}` : s;
  document.querySelectorAll("#sekmeler button[data-s]").forEach(b => b.classList.toggle("secili", b.dataset.s === s));
  let grup = "";
  document.querySelectorAll("#sekmeler .grup").forEach(g => { const ic = !!g.querySelector(`button[data-s="${s}"]`); g.classList.toggle("aktif", ic); g.classList.toggle("acik", ic); if (ic) grup = g.dataset.grup; });
  const altlar = [...document.querySelectorAll("#alt-menu button")];
  altlar.forEach(b => b.classList.remove("secili"));
  (altlar.find(b => b.dataset.s === s) || altlar.find(b => grup && b.dataset.grup === grup) || altlar.find(b => b.dataset.s === "daha")).classList.add("secili");
  $("#ust-arac").classList.remove("acik"); araKapat(); window.scrollTo(0, 0);
  const f = { bugun, rapor, gunluk: rapor, haftalik: rapor, bekleyen, kontrol, uyari, ogretmen, sikayet, basvuru, takip, ogrenci, eksi, denetim, odeme, kesinti, gonderici, sure: () => gonderici("sure"), daha }[s] || bugun;
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
    <div class="daha-grup"><h4>Raporlar</h4>${sat("rapor", "chart-column", "Rapor")}</div>
    <div class="daha-grup"><h4>Şikayetler</h4>${sat("bekleyen", "inbox", "Kararını bekleyenler", r("r-bekleyen"))}${sat("kontrol", "check", "Haftalık kontrol", r("r-kontrol"))}${sat("sikayet", "list-checks", "Tüm şikayetler")}</div>
    <div class="daha-grup"><h4>Öğretmenler</h4>${sat("ogretmen", "graduation-cap", "Öğretmen listesi")}${sat("uyari", "bell", "Uyarılar", r("r-uyari"))}${sat("takip", "eye", "Yakın takip")}${sat("denetim", "target", "Rastgele denetim")}${sat("eksi", "triangle-alert", "Eksi puanlılar")}${yon ? sat("kesinti", "shield-check", "Hesap kesintileri", r("r-kesinti")) + sat("odeme", "wallet", "Ödemeler", r("r-odeme")) : ""}</div>
    <div class="daha-grup"><h4>Diğer</h4>${sat("basvuru", "award", "Solver başvuruları", r("r-basvuru"))}${sat("ogrenci", "users", "Öğrenciler")}${yon ? sat("gonderici", "send", "Tebeşir") + sat("sure", "timer", "Tebeşir · Süreler") : ""}</div>
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

// ---------- şikayet kartı (Figma web paneli "Soru Çözümleri" kartı gibi dikey; ızgarada yan yana) ----------
function sikayetKart(s, mod) {
  const cevapli = s.tur === "c";
  // boş alan da yazılır ("yazmamış"): öğrenci not bıraktı mı, öğretmen açıklama yazdı mı bir bakışta görünsün
  const bilgi = cevapli
    ? [["Öğrencinin seçimi", [s.sebep, (s.alt_sebep || []).join(", ")].filter(Boolean).join(" · "), "—"], ["Öğrencinin notu", s.ogrenci_notu, "Yazmamış"],
       ["Yorumlar", (s.yorumlar || []).join(" / "), "Yok"], ["Öğretmenin açıklaması", s.cevap_aciklamasi, "Yazmamış"], ["Soruyu sorarken yazdığı", s.soru_aciklamasi], ["Videodaki konuşma", s.ses_dokumu && s.ses_dokumu.slice(0, 400)]]
    : [["Şikayet sebebi", s.sebep, "—"], ["Açıklaması", s.ogrenci_notu, "Yazmamış"]];
  const durum = s.durum === "hata" ? '<span class="etiket hata" data-ipucu="Admin paneline yazılırken yanıt alınamadı ve kayıt artık bekleyenlerde değil. Admin panelde bu şikayetin sonucuna bakın.">Admin\'de kontrol et</span>' : s.durum === "islendi" ? `<span class="etiket ${sonucRenk(s.son_karar)}">${sonucAdi(s.tur, s.son_karar)}</span>` : (() => { const g = Math.floor((Date.now() - new Date(s.olusturma)) / 864e5); return g >= 1 ? `<span class="etiket hata">${g} gündür bekliyor</span>` : '<span class="etiket uyari">Karar bekliyor</span>'; })();
  const hedef = s.hedef_ders ? ` → ${e(s.hedef_ders)}` : "";
  const karar = `<div class="sk-karar"><div class="sk-karar-satir"><span class="kl">İlk inceleme: <b>${kararAdi(s.tur, s.ajan_karar).split(" · ")[0]}${s.ajan_karar === "HAVUZA_AKTAR" ? hedef : ""}</b></span>
    ${s.emin_degil ? '<span class="etiket uyari" data-ipucu="İlk inceleme bu kayıtta emin olamadı, bu yüzden karar sana bırakıldı.">emin değil</span>' : ""}</div>
    ${s.dogru_cevap ? `<div class="sk-karar-satir"><span class="soluk">Doğru cevap: ${e(s.dogru_cevap)}${s.ogretmen_cevabi ? ` · Öğretmenin cevabı: ${e(s.ogretmen_cevabi)}` : ""}</span></div>` : ""}
    <div class="klamp">${e(s.gerekce)}</div>
    ${s.oneri ? `<div class="sk-karar-satir"><span class="kl mor" data-ipucu="İlk inceleme emin olamayınca kayda ikinci kez bakıldı; bu, o ikinci bakışın önerisi.">İkinci kontrol: ${kararAdi(s.tur, s.oneri).split(" · ")[0]}</span></div><div class="klamp">${e(s.oneri_gerekce)}</div>` : ""}</div>`;
  // seçim düğmesi: "Onayla · öğrenci haklı" → üstte kalın fiil, altta küçük açıklama
  const secimBtn = (v, yazi, sinif) => { const [a, b] = yazi.split(" · "); return `<button class="secim ${sinif}" data-v="${v}"><b>${a}</b>${b ? `<small>${b}</small>` : ""}</button>`; };
  let alt = "";
  if (mod === "bekleyen") {
    const sec = ["ONAYLA", "REDDET"].concat(!cevapli && s.hedef_lecture_id ? ["HAVUZA_AKTAR"] : []);
    alt = `<div class="aksiyon"><div class="sk-secimler">${sec.map(x => secimBtn(x, kararAdi(s.tur, x) + (x === "HAVUZA_AKTAR" ? hedef : ""), x === "REDDET" ? "ret" : "onay")).join("")}</div>
      <div class="sk-not" hidden><input class="not" placeholder="Not (isteğe bağlı): neden bu karar?">${cevapli ? '<input class="kucuk-not" hidden placeholder="Öğretmene küçük not (isteğe bağlı), ör. fotoğraf loş" data-ipucu="Şikayeti reddetseniz de cevapta küçük bir sorun varsa buraya yazın. Bu notlar birikir, öğretmene toplu hatırlatma olarak gider; ücreti ve puanı etkilemez.">' : ""}<button class="birincil kaydet">Kaydet</button></div></div>`;
  } else if (mod === "kontrol") {
    alt = `<div class="aksiyon"><div class="sk-secimler">${secimBtn("DOGRU", "Karar doğru", "onay")}${secimBtn("YANLIS", "Karar yanlış", "ret")}</div>
      <div class="sk-not" hidden><input placeholder="Yanlışsa neden? (zorunlu)"><button class="birincil kaydet">Kaydet</button></div></div>`;
  }
  const takipMi = String(s.key).startsWith("t:");
  const tur = takipMi ? (s.kaynak === "denetim" ? "Rastgele denetim" : "Yakın takip") : cevapli ? "Cevap" : "Soru";
  const ikonlar = `${s.ogretmen_id ? `<a class="ikon-btn" href="#" title="Öğretmenin geçmişi" aria-label="Öğretmenin geçmişi" onclick="event.preventDefault();git('ogretmen','${s.ogretmen_id}')"><i data-lucide="history"></i></a>` : ""}
    ${s.question_id ? `<a class="ikon-btn" href="${ADMIN}/Question/Detail/${s.question_id}" target="_blank" rel="noopener" title="Soruyu admin panelde aç" aria-label="Soruyu aç"><i data-lucide="external-link"></i></a>` : ""}`;
  const bilgiDolu = bilgi.filter(x => x[1] || x[2]);
  return `<section class="kart sk" data-key="${e(s.key)}" data-mod="${mod}" data-tur="${s.tur}">
    <div class="sk-bas"><b title="${e(s.ders)}">${e(s.ders)}</b><span class="sk-durum">${durum}</span><span class="sk-alt-bas">${tur}${takipMi ? "" : ` · no ${s.sikayet_id}`} · ${tarih(s.olusturma)}</span><div class="sk-ikonlar">${ikonlar}</div></div>
    <div class="sk-govde">${medya(s.soru_url, s.cevap_url, s.video_url, cevapli ? (s.ogretmen || "Cevap") : "", !cevapli)}
    <div class="sk-sag"><div class="sk-kisiler">
      ${takipMi ? "" : `<div><span>Öğrenci</span><span class="sk-ogr">${kisiLink(s.ogrenci_seo, s.ogrenci)}${s._ogr && s._ogr.k >= 5 && s._ogr.h / s._ogr.k > .4 ? `<span class="etiket hata sk-rozet" data-ipucu="Son 30 günde ${s._ogr.k} cevap şikayeti sonuçlandı, ${s._ogr.h} tanesinde öğretmen haklı çıktı">%${Math.round(s._ogr.h / s._ogr.k * 100)} haksız</span>` : ""}</span></div>`}
      <div><span>${cevapli ? "Öğretmen" : "Şikayet eden"}</span>${kisiLink(s.ogretmen_seo, s.ogretmen)}</div></div>
    ${bilgiDolu.length ? `<dl class="sk-bilgi">${bilgiDolu.map(([a, b, bos], i) => `<div><dt>${a}</dt>${b ? `<dd class="klamp${i ? "" : " vurgu"}">${e(b)}</dd>` : `<dd class="soluk">${bos}</dd>`}</div>`).join("")}</dl>` : ""}
    ${karar}</div></div>
    ${alt ? `<div class="sk-alt">${alt}</div>` : ""}</section>`;
}
function kartlariBagla(kok, yenile) {
  const s0 = sekme;
  kok.querySelectorAll("section.sk[data-mod=bekleyen],section.sk[data-mod=kontrol]").forEach(kart => {
    let secim = null;
    kart.querySelectorAll(".secim").forEach(b => b.onclick = () => { secim = b.dataset.v; kart.querySelectorAll(".secim").forEach(x => x.classList.toggle("secili", x === b));
      const n = kart.querySelector(".sk-not"); n.hidden = false; const kn = n.querySelector(".kucuk-not"); if (kn) kn.hidden = secim !== "REDDET"; n.querySelector("input").focus(); });
    const k = kart.querySelector(".kaydet");
    k.onclick = async () => {
      if (!secim) return bildir("Önce bir seçim yap.");
      const not = kart.querySelector(".aksiyon input").value.trim(), tip = kart.dataset.mod === "kontrol" ? "kontrol" : "bekleyen", kucuk = kart.querySelector(".kucuk-not")?.value.trim() || null;
      k.disabled = true; const ok = await kararKaydet(kart.dataset.key, tip, secim, not, kucuk, s0, yenile); k.disabled = false;
      if (ok) { kart.classList.add("gidiyor"); setTimeout(() => { kart.remove(); bosKontrol(kok); }, 250); }
    };
  });
}
async function kararKaydet(key, tip, secim, not, kucuk, s0, yenile) {
  if (tip === "kontrol" && secim === "YANLIS" && not.length < 3) { bildir("Yanlış dediysen kısaca nedenini yaz."); return false; }
  const { error } = await sb.rpc("d_karar_ver", { p_key: key, p_tip: tip, p_secim: secim, p_not: not, p_kucuk: secim === "REDDET" ? kucuk : null });
  if (error) { bildir(error.message === "zaten_islendi" ? "Bu kayıt zaten işlenmiş." : error.message === "isleniyor" ? "Bu kayda verilen karar şu an admin paneline işleniyor, değiştirilemez." : "Kaydedilemedi: " + error.message); return false; }
  rozetler();
  toast(tip === "kontrol" ? "Kontrol kaydedildi" : "Karar kaydedildi", tip === "kontrol" ? "Teşekkürler." : "30 saniye içinde geri alabilirsin, sonra 1-2 dakika içinde admin paneline işlenir.", async () => {
    const r = await sb.rpc("d_karar_geri_al", { p_key: key, p_tip: tip });
    if (r.error) return bildir("Geri alınamadı: süre doldu ya da karar işlenmeye başladı.");
    bildir("Geri alındı."); rozetler(); sekme === s0 && yenile && yenile();
  });
  return true;
}
function bosKontrol(kok) { if (!kok.querySelector("section.sk[data-mod]") && kok.querySelector(".bos-yer")) kok.querySelector(".bos-yer").innerHTML = '<div class="bos">Hepsi bitti.</div>'; }

// ---------- kaydırma destesi: sağa = öğrenci haklı / karar doğru · sola = öğretmen haklı / karar yanlış · yukarı = derse aktar ----------
const skGorunum = () => { try { return localStorage.getItem("skGorunum") || "deste"; } catch { return "deste"; } };
function skListe(kok, L, mod, yenile, bosYazi) {
  const g = skGorunum();
  kok.innerHTML = `<div class="cipler gorunum-sec"><button class="cip ${g === "deste" ? "secili" : ""}" data-g="deste"><i data-lucide="layers"></i>Kaydır</button><button class="cip ${g === "izgara" ? "secili" : ""}" data-g="izgara"><i data-lucide="layout-grid"></i>Izgara</button></div><div class="sk-yer"></div>`;
  kok.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { try { localStorage.setItem("skGorunum", b.dataset.g); } catch {} skListe(kok, L, mod, yenile, bosYazi); });
  const yer = kok.querySelector(".sk-yer");
  if (!L.length) yer.innerHTML = `<div class="bos">${bosYazi}</div>`;
  else if (g === "izgara") { yer.className = "sk-yer bos-yer sk-izgara"; yer.innerHTML = L.map(s => sikayetKart(s, mod)).join(""); kartlariBagla(yer, yenile); }
  else deste(yer, L, mod, yenile);
  ikon();
}
function deste(yer, L, mod, yenile) {
  const s0 = sekme, kontrolMu = mod === "kontrol";
  const sec = kontrolMu ? { sag: "DOGRU", sol: "YANLIS" } : { sag: "ONAYLA", sol: "REDDET", ust: "HAVUZA_AKTAR" };
  const havuz = s => !kontrolMu && s.tur !== "c" && s.hedef_lecture_id;
  const ad = (s, y) => kontrolMu ? (y === "sag" ? "Karar doğru" : "Karar yanlış") : y === "ust" ? "Derse aktar" : kararAdi(s.tur, sec[y]).split(" · ")[1].replace(/^./, c => c.toLocaleUpperCase("tr"));
  let i = 0, mesgul = false, bekleyenYon = null;
  yer.innerHTML = `<div class="deste-sahne"><div class="deste"></div>
    <input class="deste-not" placeholder="${kontrolMu ? "Yanlışsa neden? (sola kaydırmadan önce yaz)" : "Not (isteğe bağlı)"}">
    <div class="deste-dugmeler"><button class="dd sol" data-y="sol" title="Sola kaydır (←)"><i data-lucide="x"></i><span></span></button>
      <button class="dd ust" data-y="ust" title="Yukarı kaydır (↑)"><i data-lucide="arrow-up-right"></i><span>Derse aktar</span></button>
      <button class="dd sag" data-y="sag" title="Sağa kaydır (→)"><i data-lucide="check"></i><span></span></button></div>
    <div class="deste-sayac"></div></div>`;
  const sahne = yer.querySelector(".deste-sahne"), d = sahne.querySelector(".deste"), notK = sahne.querySelector(".deste-not");
  const ciz = () => {
    if (i >= L.length) { sahne.innerHTML = '<div class="bos">Hepsi bitti.</div>'; return; }
    const s = L[i];
    d.innerHTML = L.slice(i, i + 3).map((x, j) => sikayetKart(x, "deste").replace('class="kart sk"', `class="kart sk deste-kart" style="--j:${j}"`)).join("");
    const ust = d.firstElementChild;
    ust.insertAdjacentHTML("beforeend", `<div class="damga sag">${ad(s, "sag")}</div><div class="damga sol">${ad(s, "sol")}</div>${havuz(s) ? `<div class="damga ust">Derse aktar</div>` : ""}`);
    sahne.querySelector(".dd.sol span").textContent = ad(s, "sol"); sahne.querySelector(".dd.sag span").textContent = ad(s, "sag");
    const du = sahne.querySelector(".dd.ust"); du.hidden = !havuz(s); if (havuz(s)) du.querySelector("span").textContent = "Derse aktar → " + (s.hedef_ders || "");
    sahne.querySelector(".deste-sayac").textContent = `${i + 1} / ${L.length}`;
    bagla(ust, s); ikon();
  };
  const damga = (k, dx, dy) => { const o = { sag: Math.max(0, dx) / 110, sol: Math.max(0, -dx) / 110, ust: Math.abs(dy) > Math.abs(dx) ? Math.max(0, -dy) / 110 : 0 };
    k.querySelectorAll(".damga").forEach(m => m.style.opacity = Math.min(1, o[m.classList[1]])); };
  const geri = k => { k.style.transition = ""; k.style.transform = ""; damga(k, 0, 0); };
  async function karar(y) {
    if (mesgul || i >= L.length) return; const s = L[i], k = d.firstElementChild;
    if (y === "ust" && !havuz(s)) return geri(k);
    const not = notK.value.trim();
    if (kontrolMu && y === "sol" && not.length < 3) { geri(k); bekleyenYon = "sol"; notK.classList.add("zorunlu"); notK.focus(); return bildir("Yanlış dediysen kısaca nedenini yaz, sonra Enter."); }
    mesgul = true; bekleyenYon = null; notK.classList.remove("zorunlu");
    k.style.transition = "transform .28s cubic-bezier(.4,0,.2,1),opacity .28s"; damga(k, y === "sag" ? 200 : y === "sol" ? -200 : 0, y === "ust" ? -200 : 0);
    k.style.transform = y === "ust" ? "translateY(-120%)" : `translateX(${y === "sag" ? 130 : -130}%) rotate(${y === "sag" ? 14 : -14}deg)`; k.style.opacity = "0";
    const [ok] = await Promise.all([kararKaydet(s.key, kontrolMu ? "kontrol" : "bekleyen", sec[y], not, null, s0, yenile), new Promise(r => setTimeout(r, 280))]);
    mesgul = false;
    if (!ok) { k.style.opacity = ""; return geri(k); }
    i++; notK.value = ""; ciz();
  }
  function bagla(k, s) {
    let x0 = 0, y0 = 0, dx = 0, dy = 0, basili = false, hareket = false;
    k.addEventListener("pointerdown", ev => { if (ev.button || ev.target.closest("a,button,input,video")) return; basili = true; hareket = false; x0 = ev.clientX; y0 = ev.clientY; dx = dy = 0; });
    k.addEventListener("pointermove", ev => {
      if (!basili) return; dx = ev.clientX - x0; dy = ev.clientY - y0;
      if (!hareket && Math.hypot(dx, dy) > 8) { hareket = true; k.setPointerCapture(ev.pointerId); k.style.transition = "none"; k.classList.add("suruk"); }
      if (hareket) { k.style.transform = `translate(${dx}px,${havuz(s) ? Math.min(dy, 40) : dy * .25}px) rotate(${dx / 22}deg)`; damga(k, dx, havuz(s) ? dy : 0); }
    });
    const birak = () => { if (!basili) return; basili = false; k.classList.remove("suruk"); if (!hareket) return;
      if (dx > 110) karar("sag"); else if (dx < -110) karar("sol"); else if (havuz(s) && dy < -110 && Math.abs(dy) > Math.abs(dx)) karar("ust"); else geri(k); };
    k.addEventListener("pointerup", birak); k.addEventListener("pointercancel", () => { basili = false; k.classList.remove("suruk"); geri(k); });
    k.addEventListener("click", ev => { if (hareket) { ev.stopPropagation(); ev.preventDefault(); hareket = false; } }, true);
  }
  sahne.querySelectorAll(".dd").forEach(b => b.onclick = () => karar(b.dataset.y));
  notK.addEventListener("keydown", ev => { if (ev.key === "Enter" && bekleyenYon) karar(bekleyenYon); });
  sahne._karar = karar;
  ciz();
}
document.addEventListener("keydown", ev => {
  const sahne = document.querySelector(".deste-sahne"); if (!sahne?._karar || !$("#buyut").hidden || ev.target.matches("input,textarea,select") || ev.metaKey || ev.ctrlKey) return;
  const y = { ArrowRight: "sag", ArrowLeft: "sol", ArrowUp: "ust" }[ev.key]; if (y) { ev.preventDefault(); sahne._karar(y); }
});

// ---------- bugün: yalnız bekleyen işler + sistem durumu ----------
async function bugun() {
  const h = haftaNo(), yon = ben?.rol === "yonetici";
  const [bek, kon, konB, tas, bas, hata, dur, uh, ks] = await Promise.all([
    q(sb.from("d_sikayet").select("key,olusturma,d_karar(tip)").eq("durum", "bekliyor")),
    q(sb.from("d_sikayet").select("key,d_karar(tip)").eq("kontrol_hafta", h)),
    sb.from("d_basvuru").select("id", { count: "exact", head: true }).eq("kontrol_hafta", h).is("kontrol_secim", null),
    q(sb.from("d_uyari").select("kademe").eq("durum", "taslak")),
    sb.from("d_basvuru").select("id", { count: "exact", head: true }).eq("durum", "bekliyor").is("insan_karar", null),
    sb.from("d_sikayet").select("key", { count: "exact", head: true }).eq("durum", "hata"),
    q(sb.from("d_durum").select("*")),
    sb.from("d_uyari").select("id", { count: "exact", head: true }).eq("durum", "hata").gte("olusturma", new Date(Date.now() - 7 * 864e5).toISOString()),
    yon ? sb.from("d_kesinti").select("ogretmen_id", { count: "exact", head: true }).in("durum", ["hazir", "sorun"]) : { count: 0 },
  ]);
  const acikB = bek.filter(x => !x.d_karar.some(k => k.tip === "bekleyen")), eskiB = acikB.filter(x => Date.now() - new Date(x.olusturma) > 864e5).length;
  const nKon = kon.filter(x => !x.d_karar.some(k => k.tip === "kontrol")).length + (konB.count || 0);
  const nPas = tas.filter(t => t.kademe === "PASIF").length, nTas = tas.length - nPas;
  const D = Object.fromEntries(dur.map(x => [x.k, x])), S = D.saglik?.v || {};
  const is = [
    ["bekleyen", "Kararını bekleyen şikayetler", acikB.length, "uyari", eskiB ? `${eskiB} tanesi 1 günden eski` : ""],
    ["uyari", "Hesap kapatma önerileri", nPas, "hata"],
    ["uyari", "Onay bekleyen bildirimler", nTas, "uyari"],
    ["uyari", "Gönderilemeyen bildirimler (7 gün)", uh.count || 0, "hata"],
    ["basvuru", "Kararını bekleyen solver başvuruları", bas.count || 0, "uyari"],
    ["kontrol", "Haftalık kontrol", nKon, "mor"],
    ["sikayet", "Admin'de kontrol edilecek şikayetler", hata.count || 0, "hata"],
    ["kesinti", "Onay ya da kontrol bekleyen kesintiler", ks.count || 0, "uyari"],
  ].filter(x => x[2] > 0);
  const IK = { uyari: "circle-alert", hata: "triangle-alert", mor: "list-checks" };
  // sistem: her adımın son çalışması; sınırı aşan turuncu
  const ADIM = { cek: ["Şikayet çekme", 60], ajan_sikayet: ["Şikayet inceleme", 1440], isle: ["Admin'e yazma", 1440], ajan_basvuru: ["Başvuru inceleme", 7 * 1440], takip: ["Yakın takip", 360], solver_puan: ["Eksi puan takibi", 180] };
  const once = dk => dk < 60 ? dk + " dk" : dk < 1440 ? Math.round(dk / 60) + " sa" : Math.round(dk / 1440) + " gün";
  const cipler = Object.entries(ADIM).filter(([k]) => S[k]).map(([k, [ad, sinir]]) => { const dk = Math.round((Date.now() / 1000 - S[k].zaman) / 60); return `<span class="s-cip ${dk > sinir ? "eski" : ""}"><i></i>${ad} · ${once(dk)}</span>`; });
  const oturum = D.oturum?.v?.durum === "dustu";
  $("#icerik").innerHTML = baslik("Bugün") + `
    <div class="is-liste">${is.length ? is.map(([s_, ad, n, onem, alt]) => `<button class="is-satir ${onem}" onclick="git('${s_}')">
      <span class="is-ikon"><i data-lucide="${IK[onem]}"></i></span><span class="is-metin"><b>${ad}</b>${alt ? `<span>${alt}</span>` : ""}</span>
      <span class="is-sayi">${n}</span><i data-lucide="chevron-right" class="ok-sag"></i></button>`).join("") : '<div class="bos-ince"><i data-lucide="circle-check"></i>Bekleyen iş yok.</div>'}</div>
    <div class="sistem-serit"><span class="s-cip ${oturum ? "eski" : ""}"><i></i>Admin paneli ${oturum ? "bağlantısı koptu" : "bağlı"}</span>${cipler.join("")}${yon && D.maliyet?.v ? `<span class="s-cip bilgi">Son 24 sa API $${D.maliyet.v.son_24_saat_usd}</span>` : ""}</div>`;
}

async function tumSikayetler(gun) {
  const s = new Date(Date.now() - gun * 864e5).toISOString(); let L = [], i = 0;
  while (true) {
    const d = await q(sb.from("d_sikayet").select("key,tur,son_karar,durum,olusturma,ogretmen,ogretmen_id,gerekce,kategori,question_id,ogrenci,ogrenci_id,ogrenci_seo").gte("olusturma", s).order("olusturma").range(i, i + 999));
    L = L.concat(d); if (d.length < 1000) break; i += 1000;
  }
  return L;
}
// ---------- rapor: son 7 gün (önceki haftayla) + 30 günün gün gün dökümü ----------
async function rapor() {
  const gun = new Date(); gun.setHours(0, 0, 0, 0);
  const bas = new Date(gun - 7 * 864e5), onc = new Date(gun - 14 * 864e5), iso = d => d.toISOString();
  const [L, U, B, K, KB, E, T] = await Promise.all([
    tumSikayetler(30),
    q(sb.from("d_uyari").select("kademe,durum,gonderim").gte("gonderim", iso(bas))),
    q(sb.from("d_basvuru").select("karar,sebep").gte("islem_zamani", iso(bas))),
    q(sb.from("d_karar").select("secim").eq("tip", "kontrol").gte("zaman", iso(bas))),
    q(sb.from("d_basvuru").select("kontrol_secim").gte("kontrol_zamani", iso(bas))),
    q(sb.from("d_solver_puan").select("ad,seo,puan").lt("puan", 0)),
    q(sb.from("d_takip").select("kaynak,sonuc").gte("olusturma", iso(bas))),
  ]);
  const say = (X, f) => X.filter(f).length, haklı = X => say(X, s => s.son_karar === "ONAYLA" || s.son_karar === "HAVUZA_AKTAR");
  const bu = L.filter(s => s.olusturma >= iso(bas)), ge = L.filter(s => s.olusturma < iso(bas) && s.olusturma >= iso(onc));
  const oran = X => { const k = say(X, s => s.son_karar); return k ? Math.round(haklı(X) / k * 100) : null; };
  const fark = (a, b, ters) => { if (b == null || a == null || a === b) return '<span class="soluk">önceki hafta ' + (b ?? "—") + "</span>"; const yuk = a > b;
    return `<span class="${yuk === !!ters ? "metin-hata" : "metin-ok"}">${yuk ? "▲" : "▼"} ${Math.abs(a - b)}</span> <span class="soluk">önceki hafta ${b}</span>`; };
  const kN = K.length + KB.length, kD = say(K, x => x.secim === "DOGRU") + say(KB, x => x.kontrol_secim === "DOGRU");
  const kutu = (ik, b_, s_, a_, git_) => `<div class="kutu"><a class="k-bas k-link" href="#${git_}" onclick="event.preventDefault();git('${git_}')"><i data-lucide="${ik}"></i>${b_}<i data-lucide="chevron-right" class="k-ok"></i></a><div class="s">${s_}</div><div class="e">${a_}</div></div>`;
  const ob = oran(bu), og = oran(ge);
  // günlük döküm
  const G = {};
  for (const s of L) { const o = G[gunu(s.olusturma)] ||= { s: 0, c: 0, onay: 0, ret: 0, havuz: 0, bek: 0 };
    o[s.tur]++; if (s.durum === "bekliyor") o.bek++; else if (s.son_karar === "ONAYLA") o.onay++; else if (s.son_karar === "REDDET") o.ret++; else if (s.son_karar === "HAVUZA_AKTAR") o.havuz++; }
  const gunler = Object.keys(G).sort().reverse(), mx = Math.max(1, ...gunler.map(g => G[g].s + G[g].c));
  const cubuk = (o, n) => { const k = o.onay + o.ret + o.havuz; if (!k) return '<span class="soluk">—</span>';
    return `<div class="sonuc-cubuk" data-ipucu="${n} şikayet: öğrenci haklı ${o.onay} · öğretmen haklı ${o.ret}${o.havuz ? ` · derse aktarıldı ${o.havuz}` : ""}"><div class="yigin" style="flex:0 0 auto;width:calc((100% - 64px) * ${(n / mx).toFixed(3)})"><span class="k-haklı" style="width:${o.onay / k * 100}%"></span><span class="k-ret" style="width:${o.ret / k * 100}%"></span><span class="k-havuz" style="width:${o.havuz / k * 100}%"></span></div><small>%${Math.round(o.onay / k * 100)}</small></div>`; };
  // yan paneller
  const O = {}; bu.filter(s => s.tur === "c" && s.son_karar === "ONAYLA" && s.ogretmen_id).forEach(s => { const o = O[s.ogretmen_id] ||= { ad: s.ogretmen, n: 0, k: {} }; o.n++; kategori(s).forEach(c => o.k[c] = (o.k[c] || 0) + 1); });
  const den = T.filter(x => x.kaynak === "denetim"), tak = T.filter(x => x.kaynak === "takip");
  const sat = (a, b_, tik) => `<div class="r-sat${tik ? " tik" : ""}" ${tik ? `onclick="${tik}"` : ""}><span>${a}</span><b>${b_}</b></div>`;
  const panel = (ik, b_, ic, git_) => `<section class="kart r-panel"><h3>${git_ ? `<a href="#${git_}" onclick="event.preventDefault();git('${git_}')"><i data-lucide="${ik}"></i>${b_}<i data-lucide="chevron-right" class="k-ok"></i></a>` : `<i data-lucide="${ik}"></i>${b_}`}</h3>${ic}</section>`;
  const bild = Object.entries(U.filter(u => u.durum === "gonderildi" || u.kademe === "AKTIF").reduce((a, u) => (a[KADEME[u.kademe] || u.kademe] = (a[KADEME[u.kademe] || u.kademe] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]);
  const ret = Object.entries(B.filter(b => b.karar !== "ONAYLA").reduce((a, b) => (a[b.sebep] = (a[b.sebep] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]);
  const OB = (await q(sb.from("d_durum").select("v").eq("k", "ogrenci_bildirim")))[0]?.v;
  let obIc = "";
  if (OB) { const ids = new Set(OB.ids), t0 = new Date(OB.zaman), gun_ = Math.min(14, Math.max(0, Math.floor((Date.now() - t0) / 864e5)));
    const C = L.filter(s => s.tur === "c" && ids.has(s.ogrenci_id)), dk = (X, a, b_) => X.filter(s => new Date(s.olusturma) >= a && new Date(s.olusturma) < b_);
    const haksiz = X => { const k = say(X, s => s.son_karar); return k ? ` · %${Math.round(say(X, s => s.son_karar === "REDDET") / k * 100)} haksız` : ""; };
    const g = Math.max(gun_, 1), once_ = dk(C, new Date(t0 - g * 864e5), t0), sonra = dk(C, t0, new Date(+t0 + g * 864e5));
    obIc = Date.now() < t0 ? sat(`${OB.ids.length} öğrenci`, t0.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "'da gidecek")
      : sat(`Önceki ${g} gün`, `${once_.length}${haksiz(once_)}`) + sat(`Sonraki ${g} gün`, `${sonra.length}${haksiz(sonra)}`); }
  const aralik = `${bas.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} – ${new Date(gun - 864e5).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}`;
  $("#icerik").innerHTML = baslik("Rapor") + `
    <div class="r-bas"><h2>Son 7 gün</h2><span class="soluk">${aralik}</span></div>
    <div class="kutular">
      ${kutu("inbox", "Gelen şikayet", bu.length, `${say(bu, s => s.tur === "s")} soru · ${say(bu, s => s.tur === "c")} cevap · ${fark(bu.length, ge.length, true)}`, "sikayet")}
      ${kutu("user-check", "Öğrenci haklı", ob == null ? "—" : "%" + ob, `${haklı(bu)} şikayet · ${fark(ob, og, true)}`, "sikayet")}
      ${kutu("clock", "Kararını bekleyen", say(bu, s => s.durum === "bekliyor"), "senin kararını bekliyor", "bekleyen")}
      ${kutu("badge-check", "Otomatik karar doğruluğu", kN ? `%${Math.round(kD / kN * 100)}` : "—", kN ? `${kN} kontrolden ${kD} doğru` : "bu hafta kontrol yok", "kontrol")}
    </div>
    <div class="r-izgara">
      <section class="kart r-gunluk"><h3><i data-lucide="chart-column"></i>Son 30 gün, gün gün</h3>
        <div class="tablo-sar"><table class="tablo sik"><tr><th>Gün</th><th>Gelen</th><th>Öğrenci haklı</th><th>Öğretmen haklı</th><th>Aktarma</th><th>Bekleyen</th><th style="width:38%">Sonuç</th></tr>
        ${gunler.map(g => { const o = G[g], n = o.s + o.c; return `<tr${g >= gunu(iso(bas)) ? ' class="r-bu"' : ""}><td>${new Date(g + "T12:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" })}</td><td data-ipucu="${o.s} soru · ${o.c} cevap"><b>${n}</b></td><td>${o.onay}</td><td>${o.ret}</td><td>${o.havuz || ""}</td><td>${o.bek || ""}</td><td>${cubuk(o, n)}</td></tr>`; }).join("")}</table></div></section>
      <div class="r-yan">
        ${panel("graduation-cap", "En çok şikayeti haklı çıkan öğretmenler", Object.entries(O).sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([id, o]) => sat(`${e(o.ad)}<small>${Object.entries(o.k).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${KAT[k] || k} ${v}`).join(" · ")}</small>`, o.n, `git('ogretmen','${id}')`)).join("") || '<div class="soluk">Yok.</div>', "ogretmen")}
        ${panel("bell", "Öğretmenlere giden bildirimler", bild.map(([k, v]) => sat(e(k), v)).join("") || '<div class="soluk">Bildirim yok.</div>', "uyari")}
        ${panel("eye", "Denetim ve yakın takip", sat("Rastgele denetim", `${den.length} · ${say(den, x => x.sonuc !== "TEMIZ")} sorunlu`) + sat("Yakın takip", `${tak.length} · ${say(tak, x => x.sonuc !== "TEMIZ")} sorunlu`) + (say(tak, x => x.sonuc === "YZ_KESIN") ? sat("Yapay zekâ (kesin)", say(tak, x => x.sonuc === "YZ_KESIN")) : ""), "takip")}
        ${panel("award", "Solver başvuruları", sat("Değerlendirilen", B.length) + sat("Onaylanan", say(B, b => b.karar === "ONAYLA")) + ret.map(([k, v]) => sat("Ret · " + e(k), v)).join(""), "basvuru")}
        ${panel("triangle-alert", "Eksi puanlı solver", sat("Şu an", E.length), "eksi")}
        ${OB ? panel("megaphone", "Öğrenci bildirimi etkisi", obIc, "ogrenci") : ""}
      </div>
    </div>`;
}

// kartlardaki öğrencinin son 30 gündeki cevap şikayetleri: kaçı sonuçlandı (k), kaçında öğretmen haklı çıktı (h)
async function ogrIstat(L) {
  const ids = [...new Set(L.filter(s => s.tur === "c" && s.ogrenci_id).map(s => s.ogrenci_id))]; if (!ids.length) return;
  const R = await q(sb.from("d_sikayet").select("ogrenci_id,son_karar").eq("tur", "c").eq("durum", "islendi").in("ogrenci_id", ids).gte("olusturma", new Date(Date.now() - 30 * 864e5).toISOString()).limit(5000));
  const O = {}; R.forEach(r => { const o = O[r.ogrenci_id] ||= { k: 0, h: 0 }; o.k++; if (r.son_karar === "REDDET") o.h++; });
  L.forEach(s => s._ogr = O[s.ogrenci_id]);
}

// ---------- kararını bekleyenler ----------
async function bekleyen() {
  const L = await q(sb.from("d_sikayet").select("*,d_karar(*)").eq("durum", "bekliyor").order("olusturma"));
  const acik = L.filter(s => !s.d_karar.some(k => k.tip === "bekleyen")), sirada = L.length - acik.length;
  await ogrIstat(acik);
  $("#icerik").innerHTML = baslik("Kararını bekleyenler", "Otomatik incelemenin emin olamadığı şikayetler burada senin kararını bekler. Soru ve cevap görsellerine bak, bir karar seç, istersen not yaz ve Kaydet'e bas. Kayıt ekrandan kalkar, 30 saniye içinde geri alabilirsin; sonra 1-2 dakika içinde admin paneline işlenir.") + `
    ${sirada ? `<div class="bilgi-serit"><i data-lucide="clock"></i>${sirada} kararın admin paneline işlenmeyi bekliyor.</div>
      <div class="tablo-sar"><table class="tablo sik"><tr><th>Şikayet</th><th>Verilen karar</th><th>Kim</th><th>Durum</th></tr>${L.filter(s => !acik.includes(s)).map(s => { const k = s.d_karar.filter(x => x.tip === "bekleyen").pop();
        return `<tr><td>${e(s.ogretmen || "")} <span class="soluk">${e(s.ders || "")}</span></td><td>${kararAdi(s.tur, k.secim)}</td><td class="soluk">${e(k.kim)}</td><td>${k.uygulama_notu ? `<span class="etiket hata">${e(k.uygulama_notu)}</span>` : '<span class="soluk">sırada</span>'}</td></tr>`; }).join("")}</table></div>` : ""}
    <div id="sk-liste"></div>`;
  skListe($("#sk-liste"), acik, "bekleyen", bekleyen, "Bekleyen kayıt yok.");
}

// ---------- haftalık kontrol ----------
async function kontrol() {
  const h = haftaNo();
  const [L, B] = await Promise.all([q(sb.from("d_sikayet").select("*,d_karar(*)").eq("kontrol_hafta", h).order("olusturma")), q(sb.from("d_basvuru").select("*").eq("kontrol_hafta", h).order("id"))]);
  const acik = L.filter(s => !s.d_karar.some(k => k.tip === "kontrol")), bacik = B.filter(b => !b.kontrol_secim);
  await ogrIstat(acik);
  $("#icerik").innerHTML = baslik("Haftalık kontrol", "Otomatik kararların doğru olup olmadığını ölçmek için her hafta rastgele birkaç karar seçilir. Her birine bak: karar doğruysa \"Karar doğru\", yanlışsa \"Karar yanlış\" seç ve nedenini yaz. Yazdığın neden kurallara eklenir ve sonraki kararlarda dikkate alınır. Yanlış bir kararı admin panelinde ayrıca elle düzeltmen gerekir.") + `
    <h2>Şikayet kararları</h2><div id="sk-liste"></div>
    <h2>Solver başvuru kararları</h2><div class="bos-yer b-yer b-izgara">${bacik.length ? bacik.map(b => basvuruKart(b, true)).join("") : '<div class="bos">Bu haftanın başvuru kontrolleri bitti.</div>'}</div>`;
  skListe($("#sk-liste"), acik, "kontrol", kontrol, "Bu haftanın şikayet kontrolleri bitti."); basvuruBagla(kontrol);
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
    ${acik.length ? `<h2>Onay bekleyenler (${acik.length})</h2>` : ""}
    ${acik.length ? `<div id="u-acik" class="kart-izgara">${acik.map(kart).join("")}</div>` : '<div class="bos-ince"><i data-lucide="circle-check"></i>Onay bekleyen bildirim yok.</div>'}
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
      <td>${u.kademe === "AKTIF" ? `<span class="etiket" data-ipucu="${e(u.sonuc || "Hesap yeniden açıldı, bildirim gönderilmedi.")}">Bildirim yok</span>` : `<span class="etiket ${DUR[u.durum][1]}">${DUR[u.durum][0]}</span>${u.durum === "gonderildi" ? "" : `<div class="u-neden">${e(uyariNeden(u))}</div>`}`}</td>
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
// gönderilmeyen / hata veren bildirimin nedeni, sade dille
function uyariNeden(u) {
  const t = u.sonuc || "";
  if (u.kademe === "AKTIF") return "Hesap açıldı, bildirim gerekmedi";
  if (/sessiz saat/.test(t)) return "Hesap kapatıldı; gece olduğu için bildirim gitmedi";
  if (/sabah/.test(t)) return t.replace(/^pasife alındı,?\s*/i, "Hesap kapatıldı, ");
  if (/kesin okunamadı/.test(t)) return "Hesabın durumu okunamadı, kapatılmadı";
  if (/yeniden açıldı/.test(t)) return "Hesap yeniden açıldığı için gönderilmedi";
  if (/zaten pasif/.test(t)) return "Hesap zaten kapalıydı";
  if (/2 saatten fazla/.test(t)) return "Onay geç kaldı, uygulanmadı";
  if (/temizlendi|gerekli değil/.test(t)) return "Gereksiz bulundu";
  if (/kanıt/.test(t)) return "Aynı soru başka bildirimde kullanılmıştı";
  if (!t && u.durum === "iptal") return u.karar_veren === "otomatik" ? "Sistem göndermedi" : `"Gönderme" denildi${u.karar_veren ? " · " + (u.karar_veren.split("@")[0]) : ""}`;
  return t.replace(/^bildirim gitmedi:\s*/, "");
}
function metinGoster(b, m) {
  let d = $("#metin-dlg"); if (!d) { d = document.createElement("dialog"); d.id = "metin-dlg"; d.className = "metin-dlg"; document.body.appendChild(d); d.onclick = ev => { if (ev.target === d) d.close(); }; }
  d.innerHTML = `<h3>${e(b)}</h3><p>${e(m)}</p><div class="dlg-alt"><button class="ince" onclick="this.closest('dialog').close()">Kapat</button></div>`; d.showModal();
}

// ---------- öğretmenler ----------
// ---------- Excel gibi süz + sırala (genel tablo) ----------
// S: [{k, a: başlık, v: satır→süz/sırala değeri, h: satır→hücre HTML, tip: "metin"|"sayi"|"secim"|null, ipucu}]
function exTablo(kok, S, R, st, satirAttr = () => "", n = 80) {
  const f = st.f ||= {};
  const sec = c => [...new Set(R.map(c.v).flat().filter(v => v != null && v !== ""))].sort((a, b) => String(a).localeCompare(String(b), "tr"));
  const uyar = (c, x) => { const v = f[c.k]; if (!v) return true; const d = c.v(x);
    if (c.tip === "metin") return String(d ?? "").toLocaleLowerCase("tr").includes(v.toLocaleLowerCase("tr"));
    if (c.tip === "sayi") return d != null && Number(d) >= Number(v);
    return Array.isArray(d) ? d.includes(v) : String(d) === v; };
  const T = R.filter(x => S.every(c => uyar(c, x)));
  const sr = st.sira, sc = sr && S.find(c => c.k === sr.k);
  if (sc) T.sort((a, b) => { const p = sc.v(a), r = sc.v(b); const c = p == null || p === "" ? 1 : r == null || r === "" ? -1 : typeof p === "number" ? p - r : String(p).localeCompare(String(r), "tr"); return sr.yon * c; });
  const hucre = c => !c.tip ? "" : c.tip === "metin" ? `<input data-fk="${c.k}" value="${e(f[c.k] || "")}" placeholder="ara">`
    : c.tip === "sayi" ? `<input data-fk="${c.k}" type="number" value="${e(f[c.k] || "")}" placeholder="≥">`
    : `<select data-fk="${c.k}"><option value="">hepsi</option>${sec(c).map(v => `<option ${f[c.k] === String(v) ? "selected" : ""}>${e(v)}</option>`).join("")}</select>`;
  const L = T.slice(0, n), acik = Object.values(f).some(Boolean);
  kok.innerHTML = `<div class="ex-ust"><span class="soluk">${T.length}${T.length !== R.length ? " / " + R.length : ""} satır</span>${acik ? '<button class="metin-btn ex-sifir">Süzgeci temizle</button>' : ""}</div>
    <div class="tablo-sar ex-sar"><table class="tablo sik ex-t"><thead><tr>${S.map(c => `<th data-k="${c.k}" class="ex-sir ${sr?.k === c.k ? "aktif" : ""}"${c.ipucu ? ` data-ipucu="${e(c.ipucu)}"` : ""}>${c.a}<i>${sr?.k === c.k ? (sr.yon > 0 ? "▲" : "▼") : "↕"}</i></th>`).join("")}</tr>
    <tr class="ex-filtre">${S.map(c => `<th>${hucre(c)}</th>`).join("")}</tr></thead>
    <tbody>${L.map(x => `<tr ${satirAttr(x)}>${S.map(c => `<td>${c.h(x)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${S.length}" class="soluk">Bu süzgece uyan kayıt yok.</td></tr>`}</tbody></table></div>
    ${T.length > n ? `<button class="ince kucuk ex-daha">Daha fazla (${T.length - n})</button>` : ""}`;
  const yenile = (m = n) => exTablo(kok, S, R, st, satirAttr, m);
  kok.querySelector(".ex-daha")?.addEventListener("click", () => yenile(n + 200));
  kok.querySelector(".ex-sifir")?.addEventListener("click", () => { st.f = {}; yenile(); });
  kok.querySelectorAll("th.ex-sir").forEach(th => th.onclick = () => { const k = th.dataset.k; st.sira = st.sira?.k === k ? (st.sira.yon < 0 ? { k, yon: 1 } : null) : { k, yon: -1 }; yenile(); });
  kok.querySelectorAll("[data-fk]").forEach(el => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
    f[el.dataset.fk] = el.value; const odak = el.tagName === "INPUT" ? el.dataset.fk : null; yenile();
    if (odak) { const y = kok.querySelector(`input[data-fk="${odak}"]`); y.focus(); try { const p = y.value.length; y.setSelectionRange(p, p); } catch (_) {} }
  }));
  ikon(); st.sonra?.(kok);
}
// yığılmış yatay çubuk: P = [[ad, sayı, renkSınıfı]]
const yiginCubuk = (P, toplamYazi) => { const t = P.reduce((a, p) => a + p[1], 0); if (!t) return '<span class="soluk">—</span>';
  return `<div class="yigin" data-ipucu="${e(P.filter(p => p[1]).map(p => `${p[0]} ${p[1]}`).join(" · "))}">${P.filter(p => p[1]).map(p => `<span class="${p[2]}" style="width:${p[1] / t * 100}%"></span>`).join("")}</div>${toplamYazi ? `<small class="yigin-y">${toplamYazi}</small>` : ""}`; };

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
  const takipBilgi = o => {
    const b = bekleyenU[o.id], u = son[o.id];
    if (b) return [`${KADEME[b.kademe]} onay bekliyor`, "uyari"];
    if (takipGerekli(o)) return ["Takip gerekli", "hata", "Son 7 günde uyarı eşiğini aştı ama bildirim gitmedi."];
    if (u) return [KADEME[u.kademe], { PASIF: "hata", AKTIF: "ok", GERI: "mor", F: "mor", KUCUK: "mor", EKSI: "uyari" }[u.kademe] || "", tarih(u.gonderim || u.olusturma)];
    return null;
  };
  const KR = { yapay_zeka: "k-yz", dijital_metin: "k-dijital", soru_ustune: "k-ustune", yanlis_cevap: "k-yanlis", okunaklilik: "k-okunak", eksik_aciklama: "k-eksik", diger: "k-diger" };
  const F = { "": ["Hepsi", () => true], takip: ["Takip gerekli", takipGerekli], sik: ["Sık uyarı alan", o => (NU[o.id] || 0) >= SIK_UYARI], bildirim: ["Bildirim gitti", o => !!son[o.id]], aktif: ["Aktif", o => o.durum !== "pasif"], pasif: ["Pasif", o => o.durum === "pasif"] };
  $("#icerik").innerHTML = baslik("Öğretmenler") + `
    <div class="cipler" id="o-cip">${Object.entries(F).map(([v, [a, f]]) => `<button class="cip ${v ? "" : "secili"}" data-v="${v}">${a} <small>${O.filter(f).length}</small></button>`).join("")}</div>
    <div id="o-tablo"></div>`;
  const S = [
    { k: "ad", a: "Öğretmen", tip: "metin", v: o => o.ad, h: o => `${e(o.ad)}${sikEtiket(NU[o.id] || 0)}` },
    { k: "durum", a: "Durum", tip: "secim", v: o => o.durum === "pasif" ? "Pasif" : "Aktif", h: o => `<span class="etiket ${o.durum === "pasif" ? "hata" : "ok"}">${o.durum === "pasif" ? "Pasif" : "Aktif"}</span>` },
    { k: "h7", a: "Son 7 gün", tip: "sayi", ipucu: "Son 7 günde öğrenci haklı bulunan / sonuçlanan şikayet", v: o => H[o.id]?.onay ?? 0, h: o => H[o.id] ? `<b>${H[o.id].onay}</b> / ${H[o.id].top}` : '<span class="soluk">—</span>' },
    { k: "onay", a: "Öğrenci haklı", tip: "sayi", ipucu: "Bütün zamanlar: öğrencinin haklı bulunduğu şikayet", v: o => o.onay || 0, h: o => o.onay || 0 },
    { k: "ret", a: "Öğretmen haklı", tip: "sayi", ipucu: "Bütün zamanlar: reddedilen şikayet", v: o => o.ret || 0, h: o => o.ret || 0 },
    { k: "sebep", a: "Şikayet sebepleri", tip: "secim", ipucu: "Öğrencinin haklı bulunduğu şikayetlerin sebebi; üstüne gelince sayılar", v: o => Object.keys(o.kategoriler || {}).map(k => KAT[k] || k),
      h: o => { const E = Object.entries(o.kategoriler || {}).sort((a, b) => b[1] - a[1]); return yiginCubuk(E.map(([k, n]) => [KAT[k] || k, n, KR[k] || "k-diger"]), E.length ? `${KAT[E[0][0]] || E[0][0]} ${E[0][1]}` : ""); } },
    { k: "takip", a: "Takip / bildirim", tip: "secim", v: o => takipBilgi(o)?.[0] || "", h: o => { const t = takipBilgi(o); return t ? `<span class="etiket ${t[1]}"${t[2] ? ` data-ipucu="${e(t[2])}"` : ""}>${t[0]}</span>` : '<span class="soluk">—</span>'; } },
  ];
  const st = { sira: { k: "h7", yon: -1 }, f: {}, sonra: kok => kok.querySelectorAll("tbody tr.tik").forEach(r => r.onclick = ev => { if (!ev.target.closest("a")) git("ogretmen", r.dataset.id); }) };
  let fv = "";
  const ciz = () => exTablo($("#o-tablo"), S, O.filter(F[fv][1]), st, o => `class="tik${(NU[o.id] || 0) >= SIK_UYARI ? " sik-uyari" : ""}" data-id="${o.id}"`);
  $("#o-cip").querySelectorAll(".cip").forEach(c => c.onclick = () => { $("#o-cip").querySelectorAll(".cip").forEach(x => x.classList.toggle("secili", x === c)); fv = c.dataset.v; ciz(); });
  ciz();
}
async function ogretmenDetay(id) {
  const [o, S, U, T, P, KS, OD] = await Promise.all([
    q(sb.from("d_ogretmen").select("*").eq("id", id).maybeSingle()),
    q(sb.from("d_sikayet").select("*").eq("ogretmen_id", id).eq("tur", "c").order("olusturma", { ascending: false }).limit(200)),
    q(sb.from("d_uyari").select("*").eq("ogretmen_id", id).order("id", { ascending: false })),
    q(sb.from("d_takip").select("*").eq("ogretmen_id", id).order("cevap_tarihi", { ascending: false })),
    q(sb.from("d_solver_puan").select("*").eq("id", id).maybeSingle()),
    ben?.rol === "yonetici" ? q(sb.from("d_kesinti").select("*").eq("ogretmen_id", id)) : [],
    ben?.rol === "yonetici" ? q(sb.from("d_odeme").select("*").eq("ogretmen_id", id)) : [],
  ]);
  const seo = S.find(s => s.ogretmen_seo)?.ogretmen_seo || P?.seo;
  // tek akış: şikayet, bildirim, pasif/aktif, yakın takip, eksi puan
  const A = [];
  S.forEach(s => A.push({ z: s.olusturma, tur: "sikayet", renk: sonucRenk(s.son_karar), b: s.durum === "bekliyor" ? "Şikayet · karar bekliyor" : "Şikayet · " + sonucAdi("c", s.son_karar), m: `${s.ders || ""} — ${s.gerekce || ""}`, key: s.key }));
  U.filter(u => u.durum !== "taslak").forEach(u => A.push({ z: u.gonderim || u.karar_zamani || u.olusturma, tur: "uyari", renk: u.kademe === "PASIF" ? "hata" : u.kademe === "AKTIF" ? "ok" : "uyari",
    b: (KADEME[u.kademe] || u.kademe) + (u.durum === "gonderildi" ? " · bildirim gitti" : u.durum === "gonderiliyor" ? " · gönderiliyor" : u.kademe === "AKTIF" ? "" : " · gönderilmedi"), m: u.kademe === "AKTIF" ? (u.description || "") : u.description }));
  T.forEach(x => A.push({ z: x.cevap_tarihi, tur: "takip", renk: sonucRenk(x.sonuc), b: (x.kaynak === "denetim" ? "Rastgele denetim · " : "Yakın takip · ") + sonucAdi("c", x.sonuc), m: `${x.ders || ""} — ${x.gerekce || ""}` }));
  KS.filter(k => k.uygulama_zamani || k.durum === "hazir").forEach(k => A.push({ z: k.uygulama_zamani || k.guncelleme, tur: "para", renk: k.durum === "uygulandi" ? "hata" : "uyari", b: k.durum === "uygulandi" ? `Bakiyeden kesinti · ${String(tl(k.kesinti)).replace(/<[^>]+>/g, "")}` : "Kesinti onay bekliyor", m: `${k.incelenen ?? 0} cevap incelendi` }));
  OD.filter(x => x.odeme_zamani).forEach(x => A.push({ z: x.odeme_zamani, tur: "para", renk: "ok", b: `Kalan bakiye ödendi · ${String(tl(x.odenecek)).replace(/<[^>]+>/g, "")}`, m: x.sebep || "" }));
  if (P?.eksiye_dustu) A.push({ z: P.eksiye_dustu, tur: "eksi", renk: "hata", b: "Puan eksiye düştü", m: `Puan ${P.puan}` });
  A.sort((a, b) => (b.z || "").localeCompare(a.z || ""));
  const IK = { sikayet: "message-square-warning", uyari: "bell", takip: "eye", eksi: "trending-down", para: "wallet" };
  const S30 = S.filter(s => Date.now() - new Date(s.olusturma) < 30 * 864e5), son30 = S30.filter(s => s.son_karar), hk = son30.filter(s => s.son_karar === "ONAYLA").length;
  const kutu = (b_, v, a_, c = "") => `<div class="kutu ${c}"><div class="k-bas">${b_}</div><div class="s">${v}</div><div class="e">${a_}</div></div>`;
  $("#icerik").innerHTML = `<button class="geri" onclick="git('ogretmen')">← Öğretmenler</button>
    <div class="ust-cubuk"><div><h2>${e(o?.ad || P?.ad || "Öğretmen " + id)} ${o ? `<span class="etiket ${o.durum === "pasif" ? "hata" : "ok"}">${o.durum === "pasif" ? "Pasif" : "Aktif"}</span>` : ""}${seo ? ` <a class="ikon-btn" href="${ADMIN}/User/Detail/${e(seo)}" target="_blank" rel="noopener" title="Admin panelde profili aç"><i data-lucide="external-link"></i></a>` : ""}</h2>
</div></div>
    <div class="kutular">${kutu("Son 30 gün şikayet", S30.length, son30.length ? `%${Math.round(hk / son30.length * 100)}'inde öğrenci haklı` : "sonuçlanan yok", hk >= 3 ? "uyari" : "")}
      ${kutu("Tüm zamanlar", o ? o.onay + o.ret : S.length, o ? `${o.onay} öğrenci · ${o.ret} öğretmen haklı` : "")}
      ${kutu("Bildirim", U.filter(u => u.durum === "gonderildi" && u.kademe !== "AKTIF").length, "öğretmene giden")}
      ${kutu("Puan", P ? P.puan : "—", P?.eksiye_dustu ? "eksiye düştü " + tarih(P.eksiye_dustu) : "güncel", P && P.puan < 0 ? "hata" : "")}</div>
    <div class="cipler" id="z-cip">${[["", "Hepsi"], ["sikayet", "Şikayetler"], ["uyari", "Bildirimler"], ["takip", "Yakın takip"], ["eksi", "Puan"], ...(A.some(x => x.tur === "para") ? [["para", "Kesinti / ödeme"]] : [])].map(([v, a]) => `<button class="cip ${v ? "" : "secili"}" data-v="${v}">${a} <small>${v ? A.filter(x => x.tur === v).length : A.length}</small></button>`).join("")}</div>
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
      if (!kutu.innerHTML) { kutu.innerHTML = sikayetKart(s, "goster"); ikon(); klampBagla(kutu); }
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
      if (!alt.hidden && !alt.firstElementChild.innerHTML) { alt.firstElementChild.innerHTML = sikayetKart(L.find(s => s.key === t.dataset.key), "goster"); ikon(); klampBagla(alt); }
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
    const d = s.dogru_mu === false ? ["hata", "Yanlış"] : s.format_uygun === false ? ["uyari", "Format"] : ["ok", "Doğru"];
    return `<div class="b-kutu ${d[0]}"><div class="ciftm">${s.soru_url?.[0] ? `<div data-galeri="${si}"><img src="${e(s.soru_url[0])}" loading="lazy" alt=""></div>` : "<div></div>"}${s.cevap_url?.[0] ? `<div data-galeri="${ci}"><img src="${e(s.cevap_url[0])}" loading="lazy" alt=""></div>` : "<div></div>"}</div>
      <div class="b-alt" data-ipucu="${e([`Doğru cevap ${s.dogru_cevap || "?"} · adayın cevabı ${s.aday_cevap || "?"}`, s.not].filter(Boolean).join(" — "))}"><b>${s.no}</b><span class="b-nokta ${d[0]}">${d[1]}</span></div></div>`;
  }).join("");
  const alt = kontrol ? `<div class="sk-alt"><div class="aksiyon"><button class="secim onay" data-v="DOGRU">Karar doğru</button><button class="secim ret" data-v="YANLIS">Karar yanlış</button><input placeholder="Yanlışsa neden? (zorunlu)"><button class="birincil kucuk b-kaydet">Kaydet</button></div></div>` : "";
  const kararAlt = karar ? `<div class="sk-alt"><div class="aksiyon"><button class="secim onay" data-v="ONAYLA">Onayla</button><button class="secim ret" data-v="REDDET">Reddet</button>
      <select class="b-sebep"><option value="">Ret sebebi</option>${Object.entries(SEBEP).map(([k, v]) => `<option value="${k}">${e(v)}</option>`).join("")}</select>
      <input placeholder="Not (isteğe bağlı)"><button class="birincil kucuk b-karar">Kaydet</button></div></div>` : "";
  const oneri = karar && b.oneri ? `<div class="sk-karar"><div class="sk-karar-satir"><span class="kl mor">İkinci bakış: <b>${b.oneri === "ONAYLA" ? "Onayla" : "Reddet"}</b></span></div><div class="klamp">${e(b.oneri_gerekce)}</div></div>` : "";
  const durum = b.durum === "bekliyor" ? `<span class="etiket uyari">${b.insan_karar ? "İşleniyor" : "Kararınızı bekliyor"}</span>` : b.durum === "hata" ? '<span class="etiket uyari" data-ipucu="Karar admin paneline 3 denemede işlenemedi. Admin panelde elle onayla ya da reddet.">İşlenemedi</span>' : `<span class="etiket ${b.karar === "ONAYLA" ? "ok" : "hata"}">${b.karar === "ONAYLA" ? "Onaylandı" : "Reddedildi"}</span>`;
  const n = (b.sorular || []).length, dogru = (b.sorular || []).filter(s => s.dogru_mu !== false && s.format_uygun !== false).length;
  return `<section class="kart bk" data-bid="${b.id}">
    <div class="sk-bas"><b title="${e(b.ad)}">${e(b.ad)}</b><span class="sk-durum">${durum}</span><span class="sk-alt-bas">${e(b.ders)} · ${e(b.basvuru_tarihi)}</span>
      <div class="sk-ikonlar"><a class="ikon-btn" target="_blank" rel="noopener" title="Admin panelde aç" aria-label="Admin panelde aç" href="${ADMIN}/SolverApplication/SolverApplicationDetail/${b.id}"><i data-lucide="external-link"></i></a></div></div>
    ${b.uygulama_notu ? `<span class="etiket hata">${e(b.uygulama_notu)}</span>` : ""}
    <div class="b-grid" data-medya='${e(JSON.stringify(hepsi))}'>${grid}</div>
    <div class="sk-karar"><div class="sk-karar-satir">${karar ? `<span class="kl">İlk değerlendirme: <b>${b.karar === "ONAYLA" ? "Onayla" : "Reddet"}</b>${b.karar !== "ONAYLA" && b.sebep ? ` · ${e(b.sebep)}` : ""}</span><span class="etiket uyari">emin değil</span>` : `<span class="kl"><b>${dogru}/${n}</b> uygun</span>${b.karar !== "ONAYLA" && b.sebep ? `<span class="etiket hata">${e(b.sebep)}</span>` : ""}`}</div>${b.gerekce ? `<div class="klamp">${e(b.gerekce)}</div>` : ""}</div>${oneri}
    ${alt}${kararAlt}</section>`;
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
    ${BK.length ? `<h2>Kararınızı bekleyenler (${BK.length})</h2><div id="b-bekleyen" class="b-yer b-izgara">${BK.map(b => basvuruKart(b, false, !b.insan_karar)).join("")}</div><h2>Sonuçlananlar</h2>` : ""}
    <div class="filtre"><input id="b-ara" placeholder="İsim ya da ders"></div><div id="b-liste" class="b-izgara"></div>`;
  let fv = "";
  const ciz = () => { const a = $("#b-ara").value.toLocaleLowerCase("tr");
    $("#b-liste").innerHTML = L.filter(b => (!fv || (fv === "ONAYLA" ? b.karar === "ONAYLA" : b.sebep === fv)) && (!a || (b.ad + " " + b.ders).toLocaleLowerCase("tr").includes(a))).map(b => basvuruKart(b, false)).join("") || '<div class="bos">Kayıt yok.</div>';
    klampBagla($("#b-liste")); ikon(); };
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
    <div class="sk-izgara">${T.filter(t => t.sonuc !== "TEMIZ").map(t => sikayetKart(takipKayit(t), "goster")).join("") || '<div class="bos">Sorunlu cevap yok.</div>'}</div>`;
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
    ${grupT ? `<h2>Seçim türüne göre</h2><div class="tablo-sar"><table class="tablo sik"><tr><th>Seçim</th><th>Denetlenen</th><th>Sorunlu</th></tr>${grupT}</table></div>` : ""}
    <h2>Gün gün</h2><div class="tablo-sar" id="d-gun"><table class="tablo sik"><tr><th>Gün</th><th>Denetlenen</th><th>Sorunlu</th><th>Yapay zekâ</th></tr>
    ${Object.keys(G).sort().reverse().map(g => `<tr><td>${new Date(g + "T12:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short", weekday: "short" })}</td><td>${G[g].n}</td><td>${G[g].s}</td><td>${G[g].y}</td></tr>`).join("") || '<tr><td colspan="4" class="soluk">Henüz denetim yapılmadı. İlk denetim bugün içinde çalışacak.</td></tr>'}</table></div>
    <h2>Sorunlu çıkan öğretmenler</h2><div class="tablo-sar"><table class="tablo sik"><tr><th>Öğretmen</th><th>Denetlenen</th><th>Sorunlu</th><th>Yapay zekâ</th></tr>
    ${Object.entries(O).filter(([, o]) => o.s + o.y).sort((a, b) => (b[1].s + b[1].y) - (a[1].s + a[1].y)).map(([id, o]) => `<tr class="tik" onclick="git('ogretmen','${id}')"><td>${e(o.ad)}</td><td>${o.n}</td><td>${o.s}</td><td><b>${o.y}</b></td></tr>`).join("") || '<tr><td colspan="4" class="soluk">Yok.</td></tr>'}</table></div>
    <h2>Sorunlu bulunan cevaplar</h2><div class="sk-izgara">${L.filter(x => x.sonuc !== "TEMIZ").slice(0, 40).map(x => sikayetKart(takipKayit(x), "goster")).join("") || '<div class="bos">Sorunlu cevap yok.</div>'}</div>`;
}

// ---------- eksi puanlı solverlar ----------
async function eksi() {
  const [L, NU, GE] = await Promise.all([q(sb.from("d_solver_puan").select("*").order("puan").limit(1000)), uyariSayilari(),
    q(sb.from("d_solver_puan_gecmis").select("solver_id,zaman,puan,onceki,fark,dogru,sikayet,diger,kaynak").gte("zaman", new Date(Date.now() - 7 * 864e5).toISOString()).order("zaman").limit(5000))]);
  const G = {}; GE.forEach(g => (G[g.solver_id] ||= []).push(g));
  // son 7 günün dökümü: doğru cevap +1, onaylanan şikayet −3, kalan "diğer" (soruyu bırakma, süre aşımı) ya da bizim elle düzeltmemiz
  const D = {};
  for (const x of L) {
    const R = (G[x.id] || []).filter(g => g.fark != null), t = k => R.reduce((a, g) => a + (Number(g[k]) || 0), 0);
    D[x.id] = R.length ? { dogru: t("dogru"), sikayet: t("sikayet"), diger: R.filter(g => g.kaynak !== "elle").reduce((a, g) => a + (Number(g.diger) || 0), 0),
      elle: R.filter(g => g.kaynak === "elle").reduce((a, g) => a + Number(g.fark), 0), net: R.reduce((a, g) => a + Number(g.fark), 0) } : null;
  }
  const Lg = L.filter(x => x.puan < 20), son = L.reduce((a, x) => x.son_okuma > a ? x.son_okuma : a, "");
  const isr = n => (n > 0 ? "+" : "") + n, sayiH = (n, cls) => n ? `<span class="${cls}">${isr(n)}</span>` : '<span class="soluk">0</span>';
  const S = [
    { k: "ad", a: "Solver", tip: "metin", v: x => x.ad, h: x => `${kisiLink(x.seo, x.ad)}${sikEtiket(NU[x.id] || 0)}` },
    { k: "grup", a: "Grup", tip: "secim", v: x => x.puan < 0 ? "Eksi puanda" : "Riskte (0–19)", h: x => x.puan < 0 ? '<span class="etiket hata">Eksi puanda</span>' : '<span class="etiket uyari">Riskte</span>' },
    { k: "puan", a: "Puan", tip: "sayi", ipucu: "Admin paneldeki güncel puan", v: x => Number(x.puan), h: x => `<b class="${x.puan < 0 ? "metin-hata" : ""}">${Number(x.puan)}</b>` },
    { k: "net", a: "7 günde değişim", tip: null, ipucu: "Son 7 günde puanın toplam değişimi", v: x => D[x.id]?.net ?? null, h: x => D[x.id] ? sayiH(D[x.id].net, D[x.id].net < 0 ? "metin-hata" : "metin-ok") : '<span class="soluk">—</span>' },
    { k: "dogru", a: "Doğru cevap", tip: null, ipucu: "Her doğru cevap +1 puan", v: x => D[x.id]?.dogru ?? null, h: x => D[x.id] ? sayiH(D[x.id].dogru, "metin-ok") : '<span class="soluk">—</span>' },
    { k: "sikayet", a: "Haklı şikayet", tip: null, ipucu: "Öğrencinin haklı bulunduğu her şikayet −3 puan", v: x => D[x.id]?.sikayet ?? null, h: x => D[x.id] ? sayiH(-3 * D[x.id].sikayet, "metin-hata") : '<span class="soluk">—</span>' },
    { k: "diger", a: "Diğer ceza", tip: null, ipucu: "Soruyu bırakma, süre aşımı gibi cezalar", v: x => D[x.id]?.diger ?? null, h: x => D[x.id] ? sayiH(D[x.id].diger, D[x.id].diger < 0 ? "metin-hata" : "metin-ok") : '<span class="soluk">—</span>' },
    { k: "elle", a: "Düzeltme", tip: null, ipucu: "Bizim elle yaptığımız puan düzeltmesi", v: x => D[x.id]?.elle ?? null, h: x => D[x.id]?.elle ? sayiH(D[x.id].elle, "metin-ok") : '<span class="soluk">—</span>' },
    { k: "c3", a: "Son 3 gün cevap", tip: "sayi", v: x => x.son_3gun_cevap ?? null, h: x => x.son_3gun_cevap ?? '<span class="soluk">—</span>' },
    { k: "dustu", a: "Eksiye düştü", tip: null, v: x => x.eksiye_dustu || "", h: x => x.eksiye_dustu ? tarih(x.eksiye_dustu) : '<span class="soluk">—</span>' },
    { k: "bildirim", a: "Bildirim", tip: "secim", ipucu: "Eksiye düşünce giden otomatik bildirim", v: x => x.bildirim_zamani ? "Gitti" : "Gitmedi", h: x => x.bildirim_zamani ? `<span class="etiket ok" data-ipucu="${e(tarih(x.bildirim_zamani))}">Gitti</span>` : '<span class="soluk">—</span>' },
  ];
  $("#icerik").innerHTML = baslik("Eksi puanlı solverlar") + `
    <div class="kutular"><div class="kutu hata"><div class="s">${L.filter(x => x.puan < 0).length}</div><div class="e">eksi puanda</div></div>
      <div class="kutu uyari"><div class="s">${L.filter(x => x.puan >= 0 && x.puan < 20).length}</div><div class="e">riskte (puan 0–19)</div></div>
      <div class="kutu"><div class="s">${L.length}</div><div class="e">aktif solver</div></div>
      <div class="kutu"><div class="s">${son ? tarih(son) : "—"}</div><div class="e">son okuma</div></div></div>
    <div id="e-tablo"></div>`;
  exTablo($("#e-tablo"), S, Lg, { sira: { k: "puan", yon: 1 }, f: {} }, x => (NU[x.id] || 0) >= SIK_UYARI ? 'class="sik-uyari"' : "");
}

// ---------- uzaklaştırılanların ödemeleri ----------
const tl = n => n == null ? '<span class="soluk">—</span>' : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
// kesinti notundaki dosya yolu, e-posta ve iç kısaltmalar çalışana gösterilmez
const sadeNot = t => String(t).replace(/\s*\((?:döküm|dökümü)[^)]*\)/gi, "").replace(/\s*döküm[: ]+\S+\.json/gi, "").replace(/\S+\/\S+\.json/g, "").replace(/\s*Onaylayan:\s*\S+@\S+/gi, "").replace(/\s*·\s*$/, "").replace(/\s{2,}/g, " ").trim();
async function odeme() {
  if (ben.rol !== "yonetici") { $("#icerik").innerHTML = baslik("Uzaklaştırılanların ödemeleri", "Bu sayfada kimlik ve hesap bilgileri bulunduğu için yalnız yöneticiler görebilir."); return; }
  const L = await q(sb.from("d_odeme").select("*").order("olusturma", { ascending: false }).limit(500));
  const bekleyen = L.filter(x => x.durum === "odenecek"), bilgi = L.filter(x => x.durum === "bilgi_bekleniyor"), biten = L.filter(x => x.durum === "odendi");
  const hazir = bekleyen.filter(x => x.odenecek != null), toplam = hazir.reduce((a, x) => a + Number(x.odenecek), 0);
  const hesap = x => x.iban ? `<div class="od-hesap"><b>${e(x.hesap_sahibi || x.ad)}</b><span>${e(x.iban)}</span><span>TC ${e(x.tc || "—")} · ${e(x.il || "—")}</span>
      <button class="ince kucuk od-kopya" data-metin="${e([x.hesap_sahibi || x.ad, x.iban, x.tc, x.il].filter(Boolean).join("\n"))}">Kopyala</button></div>` : '<span class="soluk">Henüz göndermedi</span>';
  const kesinti = x => x.kesinti == null ? '<span class="etiket uyari" data-ipucu="Sakıncalı cevapların kazancı henüz hesaplanmadı. Hesaplanmadan ödeme yapılmaz.">Hesaplanmadı</span>'
    : `${tl(x.kesinti)}${x.kesinti_notu ? `<div class="soluk kucuk-yazi klamp">${e(sadeNot(x.kesinti_notu))}</div>` : ""}`;
  const islem = x => x.durum === "odendi" ? `<span class="etiket ok">Ödendi · ${tarih(x.odeme_zamani)}</span><button class="ince kucuk od-geri" data-id="${x.id}">Geri al</button>`
    : (x.durum === "odenecek" && x.odenecek != null ? `<button class="birincil kucuk od-odendi" data-id="${x.id}" data-ad="${e(x.ad)}" data-tutar="${tl(x.odenecek)}" title="Ödendi olarak işaretle"><i data-lucide="check"></i>Ödendi</button>`
      : `<span class="soluk">${x.durum === "odenecek" ? "Kesinti hesaplanınca ödenebilir" : "Ödeme bilgisi bekleniyor"}</span>`);
  const satir = x => `<tr><td><b>${e(x.ad)}</b><div class="soluk kucuk-yazi">${e(x.telefon || "")}</div></td><td>${e(x.sebep || "—")}${x.pasif_tarihi ? `<div class="soluk kucuk-yazi">${new Date(x.pasif_tarihi).toLocaleDateString("tr-TR")}</div>` : ""}</td>
    <td>${tl(x.bakiye)}</td><td>${kesinti(x)}</td><td><b>${tl(x.odenecek)}</b></td><td>${hesap(x)}</td><td class="od-islem">${islem(x)}</td></tr>`;
  const bas = `<tr><th>Solver</th><th>Neden</th><th>Bakiye</th><th style="width:28%">Kesinti</th><th>Ödenecek</th><th>Hesap bilgisi</th><th></th></tr>`;
  const tablo = (R, bos) => `<div class="tablo-sar od-tablo"><table class="tablo sik">${bas}${R.map(satir).join("") || `<tr><td colspan="7" class="soluk">${bos}</td></tr>`}</table></div>`;
  $("#icerik").innerHTML = baslik("Uzaklaştırılanların ödemeleri", "Hesabı uzaklaştırılan solverın kalan bakiyesi, sakıncalı cevapların kazancı düşüldükten sonra ay sonu ödemesiyle gönderilir. Ödeme bilgisini destek hattı toplar ve buraya işler. Ödemeyi yaptıktan sonra \"Ödendi olarak işaretle\"ye bas; yanlışlıkla bastıysan \"Geri al\" ile düzeltebilirsin.") + `
    <div class="bilgi-serit"><i data-lucide="wallet"></i>Ödemeye hazır ${hazir.length} kişi · toplam ${tl(toplam)}${bekleyen.length - hazir.length ? ` · ${bekleyen.length - hazir.length} kişinin kesintisi hesaplanmadı` : ""}</div>
    <h2>Ödenecekler (${bekleyen.length})</h2>${tablo(bekleyen, "Ödenecek kayıt yok.")}
    <h2>Ödeme bilgisi bekleniyor (${bilgi.length})</h2>${tablo(bilgi, "Bekleyen yok.")}
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
    ${D("hazir").length ? `<h2>Onay bekleyenler (${D("hazir").length})</h2>${D("hazir").map(kart).join("")}` : '<div class="bos-ince"><i data-lucide="circle-check"></i>Onay bekleyen kesinti yok.</div>'}
    ${D("onaylandi").length ? `<h2>Onaylandı, işleniyor (${D("onaylandi").length})</h2>${D("onaylandi").map(kart).join("")}` : ""}
    ${D("sorun").length ? `<h2>Sorun çıkanlar (${D("sorun").length})</h2>${D("sorun").map(kart).join("")}` : ""}
    ${D("inceleniyor").length ? `<h2>İnceleniyor (${D("inceleniyor").length})</h2>${sade(D("inceleniyor"), "")}` : ""}
    ${D("uygulandi").length ? `<h2>Tamamlananlar (${D("uygulandi").length})</h2>${D("uygulandi").map(kart).join("")}` : ""}
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
let gsYorSek = "bekleyen", gsSebep = "bugun", gsAr = { tur: "bugun" }, gsV = null, gsGorunum = "tum";
const gunStr = d => d.toLocaleDateString("sv-SE"), gunEkle = (g, n) => gunStr(new Date(new Date(g + "T12:00").getTime() + n * 864e5));
const gkisa = g => new Date(g + "T12:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
const tlStr = n => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
// soru başı ödeme: o derste insan öğretmenlere gerçekten ödenen ortalama (en az 10 örnek), yoksa bütün derslerin ortalaması
const dersAnahtar = d => String(d || "Bilinmiyor").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();  // "MATEMATİK (12)" = "Matematik (12)"
// Ders geneli: sınıf/düzey kırılımını at. "TYT Matematik (Mezun)" ve "Matematik (8. Sınıf)" → "Matematik"
const dersGenel = d => { const t = String(d || "Bilinmiyor").replace(/\([^)]*\)/g, "").replace(/^\s*(TYT|AYT|YKS|LGS|KPSS|DGS|ALES|MSÜ)\s+/i, "").replace(/\s+/g, " ").trim() || "Bilinmiyor";
  return /[a-zçğıöşü]/.test(t) ? t : t.toLocaleLowerCase("tr").replace(/(^|\s)(\S)/g, (m, b, c) => b + c.toLocaleUpperCase("tr")).replace(/ Ve /g, " ve "); };   // "FEN BİLİMLERİ" = "Fen Bilimleri"
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
// 26 Eki: Süreler Tebeşir'in alt sayfası (#sure); ana sayfa Tümü / Banka cevapları / Yapay zekâ
async function gonderici(mod) {
  gsGorunum = mod === "sure" ? "sure" : gsGorunum === "sure" ? "tum" : gsGorunum;
  const bas_ = mod === "sure" ? "Süreler" : "Tebeşir";
  if (ben.rol !== "yonetici") { $("#icerik").innerHTML = baslik(bas_, "Bu sayfayı yalnız yöneticiler görebilir."); return; }
  const [O, C] = await Promise.all([q(sb.from("d_gonderici_ozet").select("k,v,zaman").not("k", "like", "sure_%")), q(sb.from("d_gonderici_cevap").select("*").order("zaman", { ascending: false }).limit(5000))]);
  const Z = Object.fromEntries(O.map(x => [x.k, x.v])), simdi = new Date().toISOString(), senk = O.reduce((a, x) => x.zaman > a && new Date(x.zaman).toISOString() <= simdi ? x.zaman : a, "");
  if (!Z.gunler) { $("#icerik").innerHTML = baslik("Tebeşir", "Henüz veri gelmedi.") + '<div class="bos">Mac\'teki eşitleme ilk kez çalıştığında burası dolar.</div>'; return; }
  gsV = { Z, C }; gsUN = null; gsSenk = senk; gsImza = O.map(x => x.k + x.zaman).sort().join("|");
  gsCanliKur();
  $("#icerik").innerHTML = baslik(bas_, "") + `<div id="gs-serit-yer"></div>
    <div class="gs-arac"><div class="gs-sekme" id="gs-sekme"></div><div class="gs-aralik" id="gs-aralik"></div></div>
    <div id="gs-govde"></div>`;
  gsSeritCiz();
  gsAralikCiz();
}
// 25 Eki: Ulaş sayfayı yenilemeden sayıların akmasını istedi. 20 sn'de bir okunur; veri değiştiyse yeniden çizilir, sayılar eski değerden yeniye sayarak geçer.
let gsSenk = "", gsImza = "", gsZaman = null, gsSayac = {};
function gsCanliKur() {
  if (gsZaman) return;
  const tur = async () => {
    if (!$("#gs-govde")) { clearInterval(gsZaman); gsZaman = null; return; }
    if (document.hidden) return;
    gsSeritCiz();   // "son hareket x dk önce" her turda tazelensin
    const O = await sb.from("d_gonderici_ozet").select("k,v,zaman").not("k", "like", "sure_%"); if (O.error || !O.data) return;
    // 25 Eki: değişiklik bütün satırların saatinden anlaşılır (tek bir satırın saati ileri yazılınca panel donuyordu); gösterilen saat ileri olamaz
    const imza = O.data.map(x => x.k + x.zaman).sort().join("|"), simdi = new Date().toISOString();
    if (imza === gsImza) return;
    const senk = O.data.reduce((a, x) => x.zaman > a && new Date(x.zaman).toISOString() <= simdi ? x.zaman : a, "");
    const C = await sb.from("d_gonderici_cevap").select("*").order("zaman", { ascending: false }).limit(5000); if (C.error || !C.data) return;
    gsSenk = senk; gsImza = imza; gsV = { Z: Object.fromEntries(O.data.map(x => [x.k, x.v])), C: C.data }; gsUN = null;
    gsSeritCiz();
    if (document.activeElement?.closest("#gs-govde")) return;   // filtreye yazarken ekranı altından çekmeyelim; bir sonraki turda çizilir
    const acik = [...document.querySelectorAll("#gs-govde details[open]")].map(d => d.id).filter(Boolean);
    const [bas, son] = gsAralik(); gsCiz(bas, son);
    acik.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
  };
  gsZaman = setInterval(tur, 15000);
  document.onvisibilitychange = () => { if (!document.hidden && gsZaman) tur(); };
}
// sayılar: "1.234", "20%", "126,62 TL" gibi metnin sayı kısmını eskiden yeniye 0,8 sn'de say
function gsSayacAkit() {
  document.querySelectorAll("#gs-govde [data-sayac]").forEach(el => {
    const k = gsGorunum + "|" + el.dataset.sayac;
    const m = el.textContent.match(/^([^\d]*)([\d.]+(?:,\d+)?)(.*)$/); if (!m) { delete gsSayac[k]; return; }
    const oku = t => Number(t.replace(/\./g, "").replace(",", ".")), yeni = oku(m[2]), ond = (m[2].split(",")[1] || "").length, eski = gsSayac[k];
    gsSayac[k] = yeni;
    if (eski == null || eski === yeni) return;
    el.classList.add("gs-akiyor"); const t0 = performance.now();
    const adim = t => { const r = Math.min(1, (t - t0) / 800), v = eski + (yeni - eski) * (1 - Math.pow(1 - r, 3));
      el.textContent = m[1] + v.toLocaleString("tr-TR", { minimumFractionDigits: ond, maximumFractionDigits: ond }) + m[3];
      if (r < 1) requestAnimationFrame(adim); else setTimeout(() => el.classList.remove("gs-akiyor"), 600); };
    requestAnimationFrame(adim);
  });
}
// üst şerit: gönderici + yapay zekâ hesapları + canlı veri saati
function gsSeritCiz() {
  const yer = $("#gs-serit-yer"); if (!yer || !gsV) return;
  const H = gsV.Z.saglik, ai = gsV.Z.ai || {}, senk = gsSenk;
  const dk = H.son_olay ? Math.round((Date.now() - new Date(H.son_olay)) / 6e4) : null, canli = dk != null && dk <= 15 && H.surec >= 2;
  const cip = (ok, metin, ipucu, hesap) => `<${hesap ? "button" : "span"} class="gs-cip ${hesap ? "gs-cip-tik" : ""} ${ok === true ? "ok" : ok === false ? "hata" : ""}" ${hesap ? `data-hesap="${e(hesap)}"` : ""} ${ipucu ? `data-ipucu="${e(ipucu)}"` : ""}>${metin}</${hesap ? "button" : "span"}>`;
  const bugunH = ((ai.gun || {})[gunStr(new Date())] || {}).hesap || {};
  const hesaplar = Object.entries(ai.hesap_durum || {}).map(([h, d]) => {
    const acik = (ai.hesap_canli || {})[h] !== false && d.durum != "DURDU" && ai.calisiyor, planli = !acik && d.planli;
    return cip(acik ? true : planli ? null : false, `<b>${e(h)}</b> · ${acik ? "açık" : planli ? "planlı durdu" : "kapalı"}${bugunH[h] ? ` · bugün ${sayi(bugunH[h])}` : ""}`,
      (acik ? `Yapay zekâ hesabı çalışıyor. Bugün ${sayi(bugunH[h] || 0)} cevap gönderdi.` : planli ? (d.ne || "Bilerek durduruldu, arıza değil.") : (d.ne || "Beklenmedik şekilde durdu.")) + " Tıkla, cevaplarını gör.", h);
  }).join("");
  yer.innerHTML = `<div class="gs-serit" id="gs-saglik">
    ${canli || !H.planli ? cip(canli, `<b>Banka ${canli ? "çalışıyor" : "durmuş olabilir"}</b> · ${dk == null ? "—" : dk < 1 ? "az önce" : dk + " dk önce"}`, canli ? "Banka göndericisi açık ve son 15 dakikada iş yaptı." : "15 dakikadan uzun süredir hareket yok ya da program kapalı. Ulaş'a haber ver.")
      : cip(null, `<b>Banka planlı durdu</b> · ${e(H.durum_ne || "")}`, "Gönderici bilerek durduruldu, arıza değil.")}
    ${hesaplar}
    <span class="soluk gs-senk"><i class="gs-nokta"></i>Canlı · ${tarih(senk)}</span></div>`;
  yer.querySelectorAll("[data-hesap]").forEach(b => b.onclick = () => gsHesapAc(b.dataset.hesap));
}
// 27 Eki (Ulaş): hesap çipine tıklayınca o yapay zekâ hesabının cevapları satır satır; satıra tıklayınca soru + cevap görseli + yorumlar
function gsHesapAc(h, n = 100) {
  const L = gsV.C.filter(x => x.hesap === h).sort((a, b) => a.zaman < b.zaman ? 1 : -1), G = L.slice(0, n);
  gsPencere(`${e(h)} <span class="soluk">· ${sayi(L.length)} cevap</span>`, L.length ? `<div class="gs-tsar"><table class="tablo sik gs-liste-t"><thead><tr><th>Saat</th><th>Soru</th><th>Ders</th><th>Şık</th><th>Değerlendirme</th><th>Yorum</th></tr></thead><tbody>
    ${G.map(x => { const d = DEG[x.deg] || [x.deg, ""], y = (x.yorumlar || []).length;
      return `<tr class="tik ${x.deg === "yetersiz" ? "gs-yetersiz" : ""}" data-id="${x.soru_id}"><td class="nw">${tarih(x.zaman)}</td><td>${soruLink(x.soru_id, x.soru_id)}</td><td class="gs-ders-h" title="${e(x.ders || "")}">${e(dersGenel(x.ders))}</td>
        <td>${e(x.sik || "—")}</td><td><span class="etiket ${d[1]}">${d[0]}</span></td><td>${y ? `💬 ${y}` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>${L.length > n ? `<button class="gs-daha">Daha fazla (${sayi(L.length - n)})</button>` : ""}` : '<div class="bos">Bu hesabın gönderdiği cevap yok.</div>');
  const w = $("#gs-pencere .gs-p-govde");
  w.querySelector(".gs-daha")?.addEventListener("click", () => gsHesapAc(h, n + 200));
  const tb = w.querySelector("tbody"); if (!tb) return;
  tb.onclick = ev => {
    if (ev.target.closest("a")) return;
    const tr = ev.target.closest("tr.tik"), x = tr && L.find(c => c.soru_id == tr.dataset.id); if (!x) return;
    gsPencere(`<button class="ince kucuk gs-geri">← ${e(h)}</button> Soru ${x.soru_id}`, `<div class="gs-kartlar tek">${gsKart(x)}</div>`);
    $("#gs-pencere .gs-geri").onclick = () => gsHesapAc(h, n);
  };
}
function gsAralikCiz() {
  const { Z } = gsV, [bas, son] = gsAralik(), ilk = Z.gunler[0].gun, bugun = gunStr(new Date()), ai = Z.ai || {};
  $("#gs-sekme").innerHTML = gsGorunum === "sure" ? "" : [["tum", "Tümü"], ["banka", "Banka cevapları"], ["ai", `Yapay zekâ${ai.calisiyor === false ? " · kapalı" : ""}`]].map(([v, a]) => `<button class="cip ${gsGorunum === v ? "secili" : ""}" data-g="${v}">${a}</button>`).join("");
  $("#gs-sekme").querySelectorAll(".cip").forEach(b => b.onclick = () => { gsGorunum = b.dataset.g; gsTF = { sira: null, f: {} }; gsAralikCiz(); });
  $("#gs-aralik").innerHTML = `<span class="cipler">${[["bugun", "Bugün"], ["dun", "Dün"], ["7", "7 gün"], ["30", "30 gün"], ["hepsi", "Tümü"]].map(([v, a]) => `<button class="cip ${gsAr.tur === v ? "secili" : ""}" data-v="${v}">${a}</button>`).join("")}</span>
    <span class="gs-tarihler"><input type="date" id="gs-bas" value="${bas}" min="${ilk}" max="${bugun}"><span>–</span><input type="date" id="gs-son" value="${son}" min="${ilk}" max="${bugun}"></span>`;
  $("#gs-aralik").querySelectorAll(".cip").forEach(b => b.onclick = () => { gsAr = { tur: b.dataset.v }; gsAralikCiz(); });
  ["#gs-bas", "#gs-son"].forEach(s => $(s).onchange = () => { gsAr = { tur: "ozel", bas: $("#gs-bas").value, son: $("#gs-son").value }; if (gsAr.bas > gsAr.son) [gsAr.bas, gsAr.son] = [gsAr.son, gsAr.bas]; gsAralikCiz(); });
  gsCiz(bas, son);
}
// 26 Eki: Tebeşir süreleri (Ulaş). Sisteme düşen HER soru (öğretmen + Tebeşir): düşme→cevap, düşme→çözüme alınma, alınma→cevap.
// Mac'teki sure_izle.py dakikada bir d_gonderici_ozet'e gün başına 'sure_YYYY-MM-DD' yazar. Satır: [id, "SS:DD", ders, kurum, düşme→alınma, düşme→cevap, alınma→cevap, kim(0 öğretmen,1 banka,2 yapay zekâ), durum, vazgeçme]
let sDahil = true, sKir = "ders", sVeri = {}, sImza = {}, sZaman = null;
const sDk = m => m == null ? "—" : m < 1 ? "<1 dk" : m < 60 ? `${Math.round(m)} dk` : `${Math.floor(m / 60)} sa ${String(Math.round(m % 60)).padStart(2, "0")} dk`;
const sSinif = d => { const m = String(d || "").match(/\(([^()]*(Sınıf|Mezun)[^()]*)\)\s*$/i); return m ? m[1].trim() : "Diğer"; };
const sMed = v => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const sIki = o => o ? `<b>${sDk(o.md)}</b> <span class="soluk">ort ${sDk(o.o)}</span>` : "—";
const sOrt = (L, k) => { const v = L.map(x => x[k]).filter(v => v != null && v >= 0); return v.length ? { o: v.reduce((a, b) => a + b, 0) / v.length, md: sMed(v), n: v.length } : null; };
async function sYukle(bas, son) {
  const bugun = gunStr(new Date()), G = [];
  for (let g = bas; g <= son && G.length < 62; g = gunEkle(g, 1)) if (!sVeri[g] || g >= gunEkle(bugun, -1)) G.push(g);
  if (son === bugun && !G.includes(gunEkle(bugun, -1))) G.push(gunEkle(bugun, -1));   // şu an bekleyenler dünden de gelir
  if (!G.length) return false;
  const R = await sb.from("d_gonderici_ozet").select("k,v").in("k", G.map(g => "sure_" + g)); if (R.error || !R.data) return false;
  let degisti = false;
  for (const g of G) {
    const v = (R.data.find(x => x.k === "sure_" + g) || {}).v;
    if (!v) { if (!sVeri[g]) { sVeri[g] = []; degisti = true; } continue; }
    if (sImza[g] === v.t) continue;
    sImza[g] = v.t; degisti = true;
    sVeri[g] = v.r.map(r => ({ id: r[0], g, sa: r[1], ders: v.ders[r[2]], kurum: v.kurum[r[3]] || "Kurumsuz", m2: r[4], m1: r[5], m3: r[6], kim: r[7], s: r[8], bir: r[9] }));
  }
  return degisti;
}
async function sureCiz(bas, son) {
  if (!sVeri[bas]) $("#gs-govde").innerHTML = iskelet(6);
  await sYukle(bas, son);
  if (gsGorunum !== "sure" || !$("#gs-govde")) return;
  sCiz(bas, son);
  if (!sZaman) sZaman = setInterval(async () => {
    if (!$("#gs-govde") || gsGorunum !== "sure") { clearInterval(sZaman); sZaman = null; return; }
    if (document.hidden || document.activeElement?.closest("#gs-govde")) return;
    const [b, s] = gsAralik(); if (await sYukle(b, s)) sCiz(b, s);
  }, 30000);
}
function sCiz(bas, son) {
  const T = []; for (let g = bas; g <= son; g = gunEkle(g, 1)) (sVeri[g] || []).forEach(x => T.push(x));
  const ilk = Object.keys(sImza).sort()[0];
  if (!T.length) { $("#gs-govde").innerHTML = `<div class="bos">Bu aralıkta süre ölçümü yok. Ölçüm 26 Eki 01:17'de başladı${ilk ? `, ilk veri ${gkisa(ilk)}` : ""}.</div>`; return; }
  const H = T.filter(x => !x.kim), A = sDahil ? T : H, Tb = T.filter(x => x.kim), cev = T.filter(x => x.m1 != null);
  const fark = (k, L1 = T, L2 = H, en = 10) => { const a = sOrt(L1, k), b = sOrt(L2, k); return a && b && b.n >= en && a.n - b.n >= 3 ? b.o - a.o : null; };   // az örnekte fark gürültü
  const kart = (k, bas_, ipucu) => {
    const o = sOrt(A, k), diger = sOrt(sDahil ? H : T, k), f = fark(k);
    return `<section class="gs-h"><div class="gs-h-bas" data-ipucu="${e(ipucu)}">${bas_}</div>
      <div class="s-ikili"><div class="gs-h-buyuk" style="cursor:default"><span data-sayac="s${k}">${sDk(o?.md)}</span><small>medyan</small></div>
        <div class="s-ort"><span data-sayac="so${k}">${sDk(o?.o)}</span><small>ortalama</small></div></div>
      <div class="gs-h-alt">${o ? `${sayi(o.n)} soru` : "henüz ölçülmedi"}</div>
      <div class="gs-dun">${sDahil ? "Tebeşir hariç" : "Tebeşir dahil"} medyan <b>${sDk(diger?.md)}</b> · ort <b>${sDk(diger?.o)}</b>${f != null && Math.abs(f) >= 0.5 ? ` <span class="${f > 0 ? "ok" : "hata"}" data-ipucu="Tebeşir hariç ortalama ile dahil ortalama arasındaki fark">${f > 0 ? "▼" : "▲"} Tebeşir ${sDk(Math.abs(f))} ${f > 0 ? "kısaltıyor" : "uzatıyor"}</span>` : ""}</div></section>`;
  };
  const bugun = gunStr(new Date()), simdi = new Date();
  const bek = son === bugun ? [...(sVeri[gunEkle(bugun, -1)] || []), ...(sVeri[bugun] || [])].filter(x => x.s !== "A") : [];
  const yas = x => (simdi - new Date(`${x.g}T${x.sa}:00`)) / 6e4, enEski = bek.length ? Math.max(...bek.map(yas)) : null;
  const tbB = Tb.filter(x => x.kim === 1).length, tbA = Tb.length - tbB, oT = sOrt(Tb, "m1"), oH = sOrt(H, "m1");
  const etki = `<section class="kart gs-k"><div class="gs-bas"><h3>Tebeşir'in etkisi</h3></div>
    <div class="gs-minis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">
      <div><div class="soluk">Cevaplanan soru</div><b style="font-size:20px">${sayi(cev.length)}</b><div class="soluk">Tebeşir ${sayi(Tb.length)} (${yuzde(Tb.length, cev.length)}) · banka ${sayi(tbB)}, yapay zekâ ${sayi(tbA)}</div></div>
      <div data-ipucu="Soru düştükten cevap gidene kadar"><div class="soluk">Tebeşir'in cevapları</div><b style="font-size:20px">${sDk(oT?.md)}</b> <span class="soluk">medyan · ort ${sDk(oT?.o)}</span><div class="soluk">öğretmenler medyan ${sDk(oH?.md)} · ort ${sDk(oH?.o)}</div></div>
      <div data-ipucu="Tebeşir hariç: yalnız öğretmenlerin cevapladığı sorular. Tebeşir olmasaydı onun aldığı sorular da öğretmenleri bekleyecekti; gerçek etki bu farktan büyük olabilir."><div class="soluk">Bekleme</div><b style="font-size:20px">${sDk(sOrt(T, "m1")?.md)}</b> <span class="soluk">medyan · ort ${sDk(sOrt(T, "m1")?.o)}</span><div class="soluk">Tebeşir olmadan medyan ${sDk(oH?.md)} · ort ${sDk(oH?.o)}</div></div>
      ${son === bugun ? `<div data-ipucu="Şu an cevap bekleyen ya da çözümde olan sorular (dün ve bugün düşenler)"><div class="soluk">Şu an bekleyen</div><b style="font-size:20px">${sayi(bek.length)}</b><div class="soluk">${bek.length ? `en eskisi ${sDk(enEski)} · ${sayi(bek.filter(x => x.s === "C").length)} çözümde` : "kuyruk boş"}</div></div>` : ""}
    </div></section>`;
  const anah = { ders: x => dersGenel(x.ders), sinif: x => sSinif(x.ders), kurum: x => x.kurum }[sKir];
  const tablo = (L, anahF, basl, sirala) => {
    const G = {}; for (const x of L) (G[anahF(x)] ||= []).push(x);
    const S = Object.entries(G).map(([ad, X]) => ({ ad, X })); sirala(S);
    return `<table class="tablo sik gs-tablo"><tr><th>${basl}</th><th>Soru</th><th data-ipucu="Cevaplananların yüzde kaçını Tebeşir cevapladı">Tebeşir</th>
      <th data-ipucu="Soru sisteme düştükten cevap gidene kadar">Düşme → cevap <small class="soluk">medyan · ort</small></th><th data-ipucu="Soru sisteme düştükten ilk çözüme alınana kadar">Düşme → alınma <small class="soluk">medyan · ort</small></th><th data-ipucu="Çözüme alındıktan cevap gidene kadar">Alınma → cevap <small class="soluk">medyan · ort</small></th>
      <th data-ipucu="Tebeşir hariç ortalama − dahil ortalama (düşme → cevap). Yeşil: Tebeşir süreyi kısaltıyor">Etki</th></tr>
      ${S.map(({ ad, X }) => { const Y = sDahil ? X : X.filter(x => !x.kim), c = X.filter(x => x.m1 != null), tb = c.filter(x => x.kim).length, f = fark("m1", X, X.filter(x => !x.kim));
        return `<tr><td title="${e(ad)}">${e(ad)}</td><td>${sayi(X.length)}</td><td>${c.length ? yuzde(tb, c.length) : "—"}</td><td class="s-hc">${sIki(sOrt(Y, "m1"))}</td><td class="s-hc">${sIki(sOrt(Y, "m2"))}</td><td class="s-hc">${sIki(sOrt(Y, "m3"))}</td>
          <td>${f == null || Math.abs(f) < 0.5 ? '<span class="soluk">—</span>' : `<span class="${f > 0 ? "ok" : "gs-kirmizi"}">${f > 0 ? "−" : "+"}${sDk(Math.abs(f))}</span>`}</td></tr>`; }).join("")}</table>`;
  };
  const tekGun = bas === son;
  $("#gs-govde").innerHTML = `
    <div class="gs-arac" style="margin-bottom:10px"><span class="cipler" id="s-dahil">${[[1, "Tebeşir dahil"], [0, "Tebeşir hariç"]].map(([v, a]) => `<button class="cip ${+sDahil === v ? "secili" : ""}" data-v="${v}">${a}</button>`).join("")}</span>
      <span class="soluk" data-ipucu="Alınma ve cevap zamanı dakikalık gözlemle bulunur: yeni sorularda ±30 sn, birkaç saat bekleyenlerde ±15 dk. Tebeşir'in kendi soruları kesin zamanla.">Canlı · ${tarih(sImza[son] || sImza[bas] || "")}</span></div>
    <div class="gs-hero">${kart("m1", "Düşme → cevap", "Soru sisteme düştükten cevap gidene kadar geçen süre")}${kart("m2", "Düşme → çözüme alınma", "Soru sisteme düştükten biri ilk kez çözüme alana kadar")}${kart("m3", "Alınma → cevap", "Çözüme alındıktan cevap gidene kadar")}</div>
    ${etki}
    <section class="kart gs-k" style="margin-top:12px"><div class="gs-bas"><h3>Kırılım</h3><span class="cipler" id="s-kir">${[["ders", "Ders"], ["sinif", "Sınıf"], ["kurum", "Kurum"]].map(([v, a]) => `<button class="cip ${sKir === v ? "secili" : ""}" data-v="${v}">${a}</button>`).join("")}</span></div>
      ${tablo(T, anah, { ders: "Ders", sinif: "Sınıf", kurum: "Kurum" }[sKir], S => S.sort((a, b) => b.X.length - a.X.length))}</section>
    <details class="gs-analiz" id="s-zaman-d"><summary>${tekGun ? "Saat saat" : "Gün gün"}</summary><div style="padding:10px 12px">
      ${tablo(T, tekGun ? x => x.sa.slice(0, 2) + ":00" : x => gkisa(x.g), tekGun ? "Saat" : "Gün", S => S.sort((a, b) => a.X[0].g + a.X[0].sa < b.X[0].g + b.X[0].sa ? -1 : 1))}</div></details>`;
  $("#s-dahil").querySelectorAll(".cip").forEach(b => b.onclick = () => { sDahil = b.dataset.v === "1"; sCiz(bas, son); });
  $("#s-kir").querySelectorAll(".cip").forEach(b => b.onclick = () => { sKir = b.dataset.v; sCiz(bas, son); });
  gsSayacAkit(); ikon();
}
function gsCiz(bas, son) {
  if (gsGorunum === "sure") return sureCiz(bas, son);
  const { Z, C } = gsV, ai = gsGorunum === "ai", tum = gsGorunum === "tum", uy = x => tum || (x.banka_id == -1) === ai;
  const G = Z.gunler.filter(g => g.gun >= bas && g.gun <= son), top = k => G.reduce((a, g) => a + (g[k] || 0), 0);
  const Lr = C.filter(x => x.zaman.slice(0, 10) >= bas && x.zaman.slice(0, 10) <= son);
  const ad = bas === son ? gkisa(bas) : `${gkisa(bas)} – ${gkisa(son)}`;
  const B = Lr.filter(uy), dsay = k => B.filter(x => x.deg === k).length, ogr = dsay("yeterli") + dsay("yetersiz");
  const tas = gsTasarruf(B), olcul = B.filter(x => gsUcret(x.ders).tl != null).length;
  const gB = (ai || tum ? (Z.ai?.gun || {})[gunStr(new Date())] : null) || {};
  // 25 Eki: üst bölüm üç kart — (1) ne kadar cevap verdik, (2) öğrenci ne dedi, (3) ne kazandırdı. Tıklanan her şey o soruları açar.
  const bak = top("bakilan"), bakT = top("bakilan_tum") || bak, bankaN = Lr.filter(x => x.banka_id != -1).length, aiN = Lr.filter(x => x.banka_id == -1).length;
  const Gs = G.filter(g => g.sorulan), sor = Gs.reduce((a, g) => a + g.sorulan, 0), don = Gs.reduce((a, g) => a + (g.havuza_donus || 0), 0);
  const gonS = Lr.filter(x => Gs.some(g => g.gun === x.zaman.slice(0, 10))).length;
  const yz = (a, b) => b ? Math.min(100, a / b * 100) : 0;
  const cubuk = (baslik, oran, sag, parca, ipucu) => `<div class="gs-hb" data-ipucu="${e(ipucu)}"><div class="gs-hb-ust"><span>${baslik}</span><b data-sayac="${e(baslik)}">${oran}</b></div>
    <div class="gs-bar">${parca}</div><div class="gs-hb-alt">${sag}</div></div>`;
  // 27 Eki: önceki dönem (bugünse dünün aynı saatine kadar) — gönderilen ve tasarruf kartları ortak kullanır
  const OK = (() => {
    const bg = gunStr(new Date()), n = Math.round((new Date(son + "T12:00") - new Date(bas + "T12:00")) / 864e5) + 1, pb = gunEkle(bas, -n), ps = gunEkle(son, -n);
    if (gsAr.tur === "hepsi" || pb < (Z.gunler[0]?.gun || "")) return null;
    const sa = son === bg ? new Date().toTimeString().slice(0, 5) : "99";
    const L = C.filter(x => { const g = x.zaman.slice(0, 10); return g >= pb && g <= ps && (g < ps || x.zaman.slice(11, 16) <= sa) && uy(x); });
    return { L, n, et: n === 1 ? (son === bg ? "dün bu saatte" : `önceki gün (${gkisa(pb)})`) : son === bg ? `önceki ${n} gün, aynı saate kadar` : `önceki ${n} gün` };
  })();
  const k1 = `<section class="gs-h gs-h1">
    <div class="gs-h-bas">${tum ? "Tebeşir cevapları" : ai ? "Yapay zekâ cevapları" : "Banka cevapları"}</div>
    <button class="gs-h-buyuk" data-f="hepsi" data-ipucu="Tıkla, hepsini gör"><span data-sayac="gonderildi">${sayi(B.length)}</span><small>cevap gönderildi</small></button>${(() => { // 25 Eki: her aralık bir öncekiyle kıyaslanır; bugün için dünün aynı saatine kadar
      if (!OK) return "";
      const { L: OL, et, n } = OK, bg = gunStr(new Date()), d = OL.length, f = B.length - d;
      const P = gsSorOnceki(bas, son), kB = B.filter(x => Gs.some(g => g.gun === x.zaman.slice(0, 10))).length, k1_ = sor ? kB / sor : null, k0 = P && P.d ? d / P.d : null;
      const pc = v => "%" + (v * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 }), kf = k1_ != null && k0 != null ? Math.round((k1_ - k0) * 1000) / 10 : null;
      const kap = k1_ != null && k0 != null ? `<div class="gs-dun gs-kap" data-ipucu="Kapsama = gönderilen cevap ÷ bütün sorulan sorular (aynı saate kadar). Soru sayısındaki düşüşten bağımsız olarak payımızı gösterir.">kapsama ${et} <b>${pc(k0)}</b> · ${son === bg ? (n === 1 ? "bugün" : "bu aralık") : "seçili"} <b>${pc(k1_)}</b>${kf ? ` <span class="${kf > 0 ? "ok" : "hata"}">${kf > 0 ? "▲" : "▼"} ${Math.abs(kf).toLocaleString("tr-TR")} puan</span>` : ""}</div>` : "";
      return `<div class="gs-dun">${et} <b>${sayi(d)}</b>${f ? ` <span class="${f > 0 ? "ok" : "hata"}">${f > 0 ? "▲" : "▼"} ${sayi(Math.abs(f))}${d >= 10 ? ` (%${Math.round(Math.abs(f) / d * 100)})` : ""}</span>` : ""}</div>${kap}`; })()}
    <div class="gs-h-alt">${ai ? `<button class="gs-mcip" data-f="atla">${sayi(gB.atla || 0)} atlandı</button><button class="gs-mcip ${gB.hata ? "hata" : ""}" data-f="hata">${sayi(gB.hata || 0)} hata</button><span class="soluk">bugün</span>`
      : tum ? `banka ${sayi(bankaN)} · yapay zekâ ${sayi(aiN)} · ${sayi(B.filter(x => x.video).length)} video` : `${sayi(bak)} soruya bakıldı · ${sayi(B.filter(x => !x.video).length)} foto, ${sayi(B.filter(x => x.video).length)} video`}</div>
    <div class="gs-hbs">
    ${bakT ? cubuk("Baktığımız sorular", yuzde(bankaN + aiN, bakT), `<span><i class="b1"></i>banka ${sayi(bankaN)}</span><span><i class="b2"></i>yapay zekâ ${sayi(aiN)}</span><span>${sayi(bakT)} soru</span>`,
      `<span class="b1" style="width:${yz(bankaN, bakT)}%"></span><span class="b2" style="width:${yz(aiN, bakT)}%"></span>`, "Baktığımız soruların yüzde kaçına cevap gitti") : ""}
    ${sor ? (() => { const ogN = Math.max(0, sor - gonS), UG = (Z.ucret || {})._genel || {}, DG = UG.deg || {}, dn = (DG.yeterli || 0) + (DG.yetersiz || 0);
      const bizYet = Lr.filter(x => x.deg === "yetersiz" && Gs.some(g => g.gun === x.zaman.slice(0, 10))).length;
      const oran = dn >= 20 ? `yeterli %${Math.round(DG.yeterli / dn * 100)} / yetersiz %${Math.round(DG.yetersiz / dn * 100)}` : ogN ? `yetersiz ~%${Math.round(Math.max(0, don - bizYet) / ogN * 100)}` : "";
      return cubuk("Bütün sorulan sorular", yuzde(gonS, sor), `<span><i class="b3"></i>biz ${sayi(gonS)}</span><span><i class="b4"></i>öğretmenler ${sayi(ogN)}</span><span>${sayi(sor)} soru</span>`,
      `<span class="b3" style="width:${yz(gonS, sor)}%"></span><span class="b4" style="width:${yz(ogN, sor)}%"></span>`,
      `Öğretmenler ${sayi(ogN)} soru çözdü${oran ? " · " + oran : ""}${UG.ort ? " · soru başı " + tlStr(UG.ort) : ""}`) + gsSorDun(bas, son, sor); })() : ""}
    </div></section>`;
  // (2) değerlendirme halkası
  const DL = [["yeterli", "Yeterli", "hsl(var(--basari))"], ["yetersiz", "Yetersiz", "hsl(var(--hata))"], ["bekliyor", "Bekliyor", "hsl(var(--uyari) / .45)"], ...(ai ? [] : [["otomatik", "Otomatik onay", "hsl(var(--basari) / .4)"]])];
  const dTop = DL.reduce((a, [k]) => a + dsay(k), 0) || 1, R = 15.915;
  let ofs = 25; const halka = DL.map(([k, , r]) => { const n = dsay(k); if (!n) return ""; const p = n / dTop * 100, h = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${r}" stroke-width="5" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${ofs}"/>`; ofs -= p; return h; }).join("");
  const k2 = `<section class="gs-h gs-h2">
    <div class="gs-h-bas" data-ipucu="Yeterli oranı = (yeterli + otomatik onay) ÷ değerlendirilen. Bekleyenler dahil değil.">Öğrenci değerlendirmesi</div>
    <div class="gs-h2-ic"><svg class="gs-halka" viewBox="0 0 42 42"><circle r="${R}" cx="21" cy="21" fill="none" stroke="hsl(var(--muted))" stroke-width="5"/>${halka}</svg>
      <div class="gs-halka-o"><b data-sayac="yeterli-orani">${yuzde(dsay("yeterli") + dsay("otomatik"), ogr + dsay("otomatik"))}</b><small>yeterli</small></div>
      <div class="gs-lej">${DL.map(([k, a, r]) => `<button class="gs-lej-s ${k === "yetersiz" && dsay(k) ? "kirmizi" : ""}" data-f="${k}"><i style="background:${r}"></i><span>${a}</span><b data-sayac="d-${k}">${sayi(dsay(k))}</b></button>`).join("")}</div></div></section>`;
  // (3) tasarruf + son 14 gün
  const G14 = Z.gunler.slice(-14), tg = g => gsTasarruf(C.filter(x => x.zaman.slice(0, 10) === g.gun && uy(x))), V14 = G14.map(tg), mx = Math.max(1, ...V14);
  const k3 = `<section class="gs-h gs-h3">
    <div class="gs-h-bas" data-ipucu="Öğretmene gitseydi ödenecek tutar (%20 stopaj dahil)">Tasarruf</div>
    <div class="gs-h-tl" data-sayac="tasarruf">${olcul ? tlStr(tas) : "—"}</div>
    <div class="gs-h-alt">${olcul ? `soru başı ${tlStr(tas / olcul)}` : "ölçülüyor"}</div>${OK && olcul ? (() => { const d = gsTasarruf(OK.L), fk = tas - d;
      return `<div class="gs-dun">${OK.et} <b>${tlStr(d)}</b>${Math.round(fk) ? ` <span class="${fk > 0 ? "ok" : "hata"}">${fk > 0 ? "▲" : "▼"} ${tlStr(Math.abs(fk))}${d >= 50 ? ` (%${Math.round(Math.abs(fk) / d * 100)})` : ""}</span>` : ""}</div>`; })() : ""}
    <div class="gs-spark">${V14.map((v, i) => `<span class="${G14[i].gun >= bas && G14[i].gun <= son ? "sec" : ""}" style="height:${Math.max(3, v / mx * 100)}%" data-ipucu="${gkisa(G14[i].gun)}: ${tlStr(v)}"></span>`).join("")}</div>
    <div class="gs-spark-alt"><span>${gkisa(G14[0].gun)}</span><span>son 14 gün · ${tlStr(V14.reduce((a, b) => a + b, 0))}</span></div></section>`;
  const hero = `<div class="gs-hero">${k1}${k2}${k3}</div>`;
  // 26 Eki: kaçış hunisi + eşiğe yakın kaçanlar (saat saat kapsama grafiği Ulaş'ın isteğiyle kaldırıldı)
  const ek = `<div class="gs-ikili-k"><section class="kart gs-k" id="gs-huni"></section>${ai ? "" : '<section class="kart gs-k" id="gs-yakin"></section>'}</div>`;
  $("#gs-govde").innerHTML = `${hero}${ek}
    <div class="gs-yan">
      <div class="gs-sol"><section class="kart gs-k" id="gs-ders"></section><section class="kart gs-k" id="gs-yorumlar"></section></div>
      <section class="kart gs-k gs-liste-k"><div class="gs-bas"><h3>Gönderilen cevaplar <span class="soluk" id="gs-liste-n"></span></h3><button class="ince kucuk" id="gs-filtre-sifir" hidden>Filtreyi temizle</button></div><div id="gs-liste"></div></section>
    </div>
    ${ai || tum ? `<details class="gs-analiz" id="gs-atla-d"><summary>${tum ? "Yapay zekâ bugün neden atladı?" : "Bugün neden atladı?"} <span class="soluk">${sayi(gB.atla || 0)} soru</span></summary><div class="gs-atla" id="gs-atla"></div></details>` : ""}${ai ? "" : `<details class="gs-analiz" id="gs-analiz-d"><summary>Analiz ve grafikler</summary>
        <div class="gs-izgara"><section class="kart gs-k" id="gs-sebep"></section><section class="kart gs-k" id="gs-benz"></section><section class="kart gs-k" id="gs-14"></section><section class="kart gs-k" id="gs-yorum"></section></div></details>`}`;
  gsB = B;
  gsHuniCiz(G, gsGorunum); if (!ai) gsYakinCiz(G);
  gsDersCiz(B, ai ? [] : Z.ders_7 || []);
  gsListe(B);
  gsYorumlarCiz(Z.yorum || {});
  if (ai || tum) gsAtlaCiz(gB); if (!ai) { gsSebepCiz(Z); gsBenzCiz(Z); gs14Ciz(Z.gunler); gsYorumCiz(Z.yorum || {}); }
  $("#gs-govde").querySelectorAll(".gs-hero [data-f]").forEach(b => b.onclick = () => {
    const f = b.dataset.f;
    if (f === "atla") { const d = $("#gs-atla-d"); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (f === "hata") { const hs = gB.hata_sebep || {}; return gsPencere("Bugünkü gönderim hataları", `<div class="gs-atla">${Object.keys(hs).length ? Object.entries(hs).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="gs-sat"><span class="gs-et">${e(k)}</span><b>${n}</b></div>`).join("") : '<p class="soluk">Bugün hata yok.</p>'}</div>`); }
    const L = f === "hepsi" ? B : B.filter(x => x.deg === f);
    gsKartlar(`${ad} · ${{ hepsi: "gönderilen cevaplar", otomatik: "otomatik onay" }[f] || (DEG[f] || [f])[0]}`, L);
  });
  gsSayacAkit();
}
let gsB = [];
const gsAd = k => GS_ADI[k] || (k.startsWith("ogrenci_notu") ? "Öğrencinin özel notu var → yapay zekâya" : k.startsWith("hazirlik_hatasi") ? "Cevap hazırlanırken hata" : k.startsWith("banka_ai_celiski") ? "Banka ile yapay zekâ çelişti" : k);
const gsPc = v => v == null ? "—" : "%" + (v * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
// 26 Eki: kaçış hunisi — sorulan → göndericinin gördüğü → bankada eşleşen → banka cevabı; her basamağın altında kaybı ve kısa sebebi
const GS_HUNI_AD = { alinamadi: "başka öğretmen aldı", banka_gorsel_yok: "cevap görseli yok", yeniden_ai: "tekrar soruldu → YZ", gonderim_hatasi: "gönderim hatası" };
function gsHuniCiz(G, mod) {
  const D = G.filter(g => g.huni && g.sorulan), el = $("#gs-huni"); if (!el) return;
  const bas_ = '<div class="gs-bas"><h3>Sorular nereye gitti?</h3></div>';
  if (!D.length) { el.innerHTML = bas_ + '<p class="soluk">Bu aralık için veri yok.</p>'; return; }
  const top = k => D.reduce((a, g) => a + (g.huni[k] || 0), 0), sor = D.reduce((a, g) => a + g.sorulan, 0), Ai = D.map(g => ((gsV.Z.ai || {}).gun || {})[g.gun] || {});
  const say = (O, f) => Object.entries(O).sort((a, b) => (a[0] === "diğer") - (b[0] === "diğer") || b[1] - a[1]).slice(0, f).map(([a, n]) => `${e(a)} ${sayi(n)}`).join(" · ");
  const sat = (ad, v, parca, kayip, ne) => `<div class="gs-huni-s"><span class="gs-huni-ad">${ad}</span><span class="gs-huni-cub">${parca.map(([r, n]) => `<span class="${r}" style="width:${Math.max(n ? 1 : 0, n / sor * 100)}%"></span>`).join("")}</span><b>${sayi(v)}</b><span class="gs-huni-y">${yuzde(v, sor)}</span></div>
    ${kayip > 0 ? `<div class="gs-huni-dus"><b>−${sayi(kayip)}</b> ${ne}</div>` : ""}`;
  const gonB = top("gon"), gonA = Ai.reduce((a, x) => a + (x.gon || 0), 0);
  if (mod === "banka") {
    const gor = Math.min(top("gor"), sor), yok = top("yok"), esl = gor - yok, K = {};
    D.forEach(g => Object.entries(g.huni.kayip || {}).forEach(([k, n]) => { const a = k.startsWith("ogrenci_notu") ? "öğrenci notu → YZ" : GS_HUNI_AD[k] || "diğer"; K[a] = (K[a] || 0) + n; }));
    el.innerHTML = bas_ + sat("Sorulan", sor, [["b4", sor]], sor - gor, "gönderici görmeden alındı") + sat("Göndericinin gördüğü", gor, [["b0", gor]], yok, "bankada yok")
      + sat("Bankada eşleşen", esl, [["b0", esl]], esl - gonB, say(K, 9)) + sat("Banka cevabı gitti", gonB, [["b1", gonB]], 0);
  } else if (mod === "ai") {
    const bak = Math.min(top("ai_bak"), sor), K = {}; Ai.forEach(x => Object.entries(x.sebep || {}).forEach(([k, n]) => { const a = /^(hata|banka_celiski)/.test(k) ? "diğer" : k.replace(/\s*\(.*\)$/, ""); K[a] = (K[a] || 0) + n; }));
    el.innerHTML = bas_ + sat("Sorulan", sor, [["b4", sor]], sor - bak, "yapay zekâya gelmedi (banka cevapladı ya da başkası aldı)")
      + sat("Yapay zekânın baktığı", bak, [["b0", bak]], bak - gonA, say(K, 4)) + sat("Yapay zekâ cevabı gitti", gonA, [["b2c", gonA]], 0);
  } else {
    const gor = Math.min(D.reduce((a, g) => a + (g.bakilan_tum || g.huni.gor), 0), sor), gon = gonB + gonA;
    el.innerHTML = bas_ + sat("Sorulan", sor, [["b4", sor]], sor - gor, "Tebeşir görmeden alındı") + sat("Tebeşir'in gördüğü", gor, [["b0", gor]], gor - gon, "cevaplanamadı · ayrıntısı Banka ve Yapay zekâ sekmelerinde")
      + sat("Cevap gitti", gon, [["b1", gonB], ["b2c", gonA]], 0) + `<div class="gs-huni-dus gs-huni-lej"><span><i class="b1"></i>banka ${sayi(gonB)}</span><span><i class="b2c"></i>yapay zekâ ${sayi(gonA)}</span></div>`;
  }
}
// 26 Eki: benzerliği eşiğin hemen altında kalıp atlanan sorular; eşiği düşürseydik kaç soru daha giderdi (cevabın doğruluğu ayrıca kontrol edilmeli)
function gsYakinCiz(G) {
  const el = $("#gs-yakin"); if (!el) return;
  const es = Number(gsV.Z.saglik?.esik) || 0.8, Y = {}; G.forEach(g => Object.entries(g.yakin || {}).forEach(([k, n]) => { Y[k] = (Y[k] || 0) + n; }));
  const adim = []; for (let t = Math.round((es - 0.02) * 100); t >= 70; t -= 2) adim.push(t / 100);
  const ek = t => Object.entries(Y).reduce((a, [k, n]) => a + (Number(k) >= t ? n : 0), 0), mx = Math.max(1, ek(0.70));
  el.innerHTML = `<div class="gs-bas"><h3>Eşiğe yakın kaçanlar</h3></div><p class="gs-acikla">Benzerliği 0,70 ile eşik (${es.toFixed(2).replace(".", ",")}) arasında kalıp atlanan sorular. Eşiği düşürseydik bankadan kaç cevap daha giderdi?</p>
    ${G.some(g => g.yakin) ? adim.map(t => { const n = ek(t); return `<div class="gs-sat gs-sat-2" data-ipucu="Eşik ${String(t).replace(".", ",")} olsaydı ${sayi(n)} soru daha eşleşirdi"><span class="gs-et">eşik ${t.toFixed(2).replace(".", ",")}</span><span class="gs-cub"><span class="foto" style="width:${n / mx * 100}%"></span></span><b>+${sayi(n)}</b></div>`; }).join("")
      + '<p class="soluk gs-dip">Dikkat: eşiğin altındaki eşleşmelerde bankadaki cevap yanlış soruya ait olabilir. Eşiği düşürmeden önce örnekleri kontrol etmek gerekir.</p>' : '<p class="soluk">Bu aralık için veri yok.</p>'}`;
}
// 26 Eki: "Bütün sorulan sorular" da bir önceki aralıkla kıyaslanır; bugün için dünün aynı saatine kadar (panel_senk sorulan_10dk = 144 dilim, son dilim orantılı)
function gsSorOnceki(bas, son) {
  const { Z } = gsV, bg = gunStr(new Date()), n = Math.round((new Date(son + "T12:00") - new Date(bas + "T12:00")) / 864e5) + 1, pb = gunEkle(bas, -n), ps = gunEkle(son, -n);
  if (gsAr.tur === "hepsi") return null;
  const sim = new Date(), dk = son === bg ? sim.getHours() * 60 + sim.getMinutes() : 1440;
  let d = 0;
  for (let g = pb; g <= ps; g = gunEkle(g, 1)) {
    const D = (Z.gunler.find(x => x.gun === g) || {}).sorulan_10dk; if (!D) return null;
    d += g < ps ? D.reduce((a, b) => a + b, 0) : D.slice(0, Math.floor(dk / 10)).reduce((a, b) => a + b, 0) + (dk < 1440 ? (D[Math.floor(dk / 10)] || 0) * (dk % 10) / 10 : 0);
  }
  return { d: Math.round(d), n, pb };
}
function gsSorDun(bas, son, sor) {
  const P = gsSorOnceki(bas, son); if (!P) return "";
  const { d, n, pb } = P, bg = gunStr(new Date()), f = sor - d;
  const et = n === 1 ? (son === bg ? "dün bu saatte" : `önceki gün (${gkisa(pb)})`) : son === bg ? `önceki ${n} gün, aynı saate kadar` : `önceki ${n} gün`;
  return `<div class="gs-dun">${et} <b>${sayi(d)}</b> soru${f ? ` <span class="${f > 0 ? "ok" : "hata"}">${f > 0 ? "▲" : "▼"} ${sayi(Math.abs(f))}${d >= 10 ? ` (%${Math.round(Math.abs(f) / d * 100)})` : ""}</span>` : ""}</div>`;
}
function gsAtlaCiz(g) {
  const S = Object.entries(g.sebep || {}).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...S.map(x => x[1]));
  $("#gs-atla").innerHTML = S.length ? S.map(([k, n]) => `<div class="gs-sat gs-sat-2"><span class="gs-et" title="${e(k)}">${e(k)}</span><span class="gs-cub"><span class="foto" style="width:${n / mx * 100}%"></span></span><b>${n}</b></div>`).join("") : '<p class="soluk">Bugün atlanan soru yok.</p>';
}
// ---------- açılır pencere: soru + cevap kartları ----------
function gsPencere(baslikM, icerik) {
  let p = $("#gs-pencere");
  if (!p) {
    document.body.insertAdjacentHTML("beforeend", '<div id="gs-pencere" class="gs-pencere" hidden><div class="gs-p-kutu" role="dialog" aria-modal="true"><div class="gs-p-ust"><h3></h3><button class="gs-p-kapat" aria-label="Kapat">×</button></div><div class="gs-p-govde"></div></div></div>');
    p = $("#gs-pencere");
    p.onclick = ev => { if (ev.target === p || ev.target.closest(".gs-p-kapat")) gsPencereKapat(); };
    document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !p.hidden && $("#buyut")?.hidden !== false) gsPencereKapat(); });
  }
  p.querySelector("h3").innerHTML = baslikM; p.querySelector(".gs-p-govde").innerHTML = icerik; p.querySelector(".gs-p-govde").scrollTop = 0;
  p.hidden = false; document.body.classList.add("gs-kilit");
}
function gsPencereKapat() { const p = $("#gs-pencere"); if (p) p.hidden = true; document.body.classList.remove("gs-kilit"); }
const GS_KNT = { banka_yanlis: ["Cevabımız yanlıştı", "gs-knt-k"], cevap_dogru: ["Cevabımız doğru", "gs-knt-y"], belirsiz: ["Belirsiz", "gs-knt-n"] };
function gsKart(x) {
  const K = gsV.Z.kontrol || {}, k = K[x.soru_id], d = DEG[x.deg] || [x.deg, ""], vid = x.video ? x.cevap_foto[0] : null;
  return `<article class="gs-kart ${x.deg === "yetersiz" ? "gs-kart-k" : ""}">
    <div class="gs-kart-ust">${soruLink(x.soru_id, "Soru " + x.soru_id)}<span class="soluk">${tarih(x.zaman)}</span><span class="etiket ${d[1]}">${d[0]}</span>
      ${x.banka_id == -1 ? '<span class="etiket">Yapay zekâ</span>' : x.benzerlik != null ? `<span class="soluk" data-ipucu="1 = bankadaki soruyla aynı">benzerlik ${Number(x.benzerlik).toFixed(2).replace(".", ",")}</span>` : ""}</div>
    <div class="soluk gs-kart-ders">${e(x.ders || "—")}${[x.unite, x.konu].filter(Boolean).length ? " · " + [x.unite, x.konu].filter(Boolean).map(e).join(" › ") : ""}${x.sik ? ` · şık <b>${e(x.sik)}</b>` : ""}</div>
    ${medya(x.soru_foto, vid ? [] : x.cevap_foto, vid, "Cevap")}
    ${x.deg_metin ? `<div class="gs-kart-not"><b>Değerlendirme:</b> ${e(x.deg_metin)}</div>` : ""}
    ${k ? `<div class="gs-knt-kutu ${(GS_KNT[k.karar] || [])[1] || "gs-knt-n"}"><b>${(GS_KNT[k.karar] || [k.karar])[0]}:</b> ${e(k.aciklama)}</div>` : ""}
    ${(x.yorumlar || []).some(y => y.kaynak !== "degerlendirme") || ((gsV.Z.yorum || {}).gonderilen || []).some(g => g.soru == x.soru_id) ? gsIplik({ ...x, yorumlar: (x.yorumlar || []).filter(y => y.kaynak !== "degerlendirme") }, [], false) : ""}
  </article>`;
}
function gsKartlar(baslikM, L, n = 24) {
  const T = [...L].sort((a, b) => a.zaman < b.zaman ? 1 : -1);
  gsPencere(`${e(baslikM)} <span class="soluk">${sayi(T.length)}</span>`, T.length ? `<div class="gs-kartlar">${T.slice(0, n).map(gsKart).join("")}</div>${T.length > n ? `<button class="gs-daha" id="gs-p-daha">${sayi(T.length - n)} tane daha göster</button>` : ""}` : '<div class="bos">Bu kutuda soru yok.</div>');
  const d = $("#gs-p-daha"); if (d) d.onclick = () => { const g = $("#gs-pencere .gs-p-govde"), y = g.scrollTop; gsKartlar(baslikM, L, n + 24); $("#gs-pencere .gs-p-govde").scrollTop = y; };
}
// ---------- gönderilen cevaplar: Excel gibi süz + sırala ----------
let gsTF = { sira: null, f: {} };
function gsListe(C, n = 60) {
  const ai = gsGorunum === "ai";
  const S = [["zaman", "Saat"], ["soru_id", "Soru"], ["ders", "Ders"], ...(ai ? [] : [["benzerlik", "Benzerlik"]]), ["tur", "Tür"], ["deg", "Değerlendirme"]];
  const deger = (x, k) => k === "tur" ? (gsGorunum === "tum" ? (x.banka_id == -1 ? "Yapay zekâ · " : "Banka · ") : "") + (x.video ? "Video" : "Fotoğraf") : k === "ders" ? dersGenel(x.ders) : k === "deg" ? (DEG[x.deg] || [x.deg])[0] : x[k];
  const sec = k => [...new Set(C.map(x => deger(x, k)).filter(v => v != null && v !== ""))].sort((a, b) => String(a).localeCompare(String(b), "tr"));
  const f = gsTF.f;
  let T = C.filter(x => S.every(([k]) => { const v = f[k]; if (!v) return true;
    if (k === "soru_id") return String(x.soru_id).includes(v);
    if (k === "benzerlik") return x.benzerlik != null && x.benzerlik >= Number(v);
    if (k === "zaman") return tarih(x.zaman).toLocaleLowerCase("tr").includes(v.toLocaleLowerCase("tr"));
    return String(deger(x, k)) === v; }));
  const sr = gsTF.sira;
  if (sr) T.sort((a, b) => { const p = deger(a, sr.k), r = deger(b, sr.k); const c = p == null ? 1 : r == null ? -1 : typeof p === "number" ? p - r : String(p).localeCompare(String(r), "tr"); return sr.yon * c; });
  else { const o = { yetersiz: 0 }; T.sort((a, b) => (o[a.deg] ?? 1) - (o[b.deg] ?? 1) || (a.zaman < b.zaman ? 1 : -1)); }
  const filtreHucre = k => {
    if (k === "soru_id" || k === "zaman") return `<input data-fk="${k}" value="${e(f[k] || "")}" placeholder="ara">`;
    if (k === "benzerlik") return `<select data-fk="${k}"><option value="">hepsi</option>${[.95, .9, .85, .8].map(v => `<option value="${v}" ${f[k] == v ? "selected" : ""}>≥ ${String(v).replace(".", ",")}</option>`).join("")}</select>`;
    return `<select data-fk="${k}"><option value="">hepsi</option>${sec(k).map(v => `<option ${f[k] === v ? "selected" : ""}>${e(v)}</option>`).join("")}</select>`;
  };
  const L = T.slice(0, n);
  $("#gs-liste-n").textContent = `· ${sayi(T.length)}${T.length !== C.length ? " / " + sayi(C.length) : ""}`;
  $("#gs-filtre-sifir").hidden = !Object.values(f).some(Boolean) && !sr;
  $("#gs-liste").innerHTML = `<div class="gs-tsar"><table class="tablo sik gs-liste-t"><thead><tr>${S.map(([k, a]) => `<th data-k="${k}" class="gs-sir ${sr?.k === k ? "aktif" : ""}">${a}<i>${sr?.k === k ? (sr.yon > 0 ? "▲" : "▼") : "↕"}</i></th>`).join("")}</tr>
    <tr class="gs-filtre">${S.map(([k]) => `<th>${filtreHucre(k)}</th>`).join("")}</tr></thead><tbody>
    ${L.map(x => { const d = DEG[x.deg] || [x.deg, ""], kn = (gsV.Z.kontrol || {})[x.soru_id];
      return `<tr class="tik ${x.deg === "yetersiz" ? "gs-yetersiz" : ""}" data-id="${x.soru_id}"><td class="nw">${tarih(x.zaman)}</td><td>${soruLink(x.soru_id, x.soru_id)}</td><td class="gs-ders-h" title="${e(x.ders || "")}">${e(dersGenel(x.ders))}</td>
        ${ai ? "" : `<td>${x.benzerlik == null ? "—" : Number(x.benzerlik).toFixed(2).replace(".", ",")}</td>`}<td>${e(deger(x, "tur"))}</td>
        <td><div class="gs-deg-h"><span class="etiket ${d[1]}" data-ipucu="${e([x.deg_metin, kn && kn.aciklama].filter(Boolean).join(" — "))}">${d[0]}${kn ? ` · ${{ banka_yanlis: "cevap yanlış", cevap_dogru: "cevap doğru", belirsiz: "belirsiz" }[kn.karar] || e(kn.karar)}` : ""}</span></div></td></tr>`; }).join("")}
    </tbody></table>${L.length ? "" : '<div class="bos">Bu süzgece uyan cevap yok.</div>'}</div>${T.length > n ? `<button class="gs-daha">Daha fazla (${sayi(T.length - n)})</button>` : ""}`;
  const w = $("#gs-liste");
  w.querySelector(".gs-daha")?.addEventListener("click", () => gsListe(C, n + 100));
  w.querySelectorAll("th.gs-sir").forEach(th => th.onclick = () => { const k = th.dataset.k; gsTF.sira = gsTF.sira?.k === k ? (gsTF.sira.yon > 0 ? { k, yon: -1 } : null) : { k, yon: 1 }; gsListe(C, n); });
  w.querySelectorAll("[data-fk]").forEach(el => {
    const uygula = () => { gsTF.f[el.dataset.fk] = el.value; const odak = el.tagName === "INPUT" ? el.dataset.fk : null, pos = el.selectionStart; gsListe(C, n);
      if (odak) { const yeni = w.querySelector(`input[data-fk="${odak}"]`); yeni.focus(); yeni.setSelectionRange(pos, pos); } };
    el.addEventListener(el.tagName === "INPUT" ? "input" : "change", uygula);
  });
  $("#gs-filtre-sifir").onclick = () => { gsTF = { sira: null, f: {} }; gsListe(C, n); };
  w.querySelector("tbody").onclick = ev => {
    if (ev.target.closest("a")) return;
    const tr = ev.target.closest("tr.tik"); if (!tr) return;
    const x = C.find(c => c.soru_id == tr.dataset.id); if (!x) return;
    gsPencere(`Soru ${x.soru_id}`, `<div class="gs-kartlar tek">${gsKart(x)}</div>`);
  };
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
    ${kucuk("Yeterli oranı · ortalama", g => oran((g.yeterli || 0) + (g.otomatik || 0), (g.yeterli || 0) + (g.yetersiz || 0) + (g.otomatik || 0)), oran(top("yeterli") + top("otomatik"), top("yeterli") + top("yetersiz") + top("otomatik")), yz)}
    ${kucuk("Tasarruf · toplam", tg, G.reduce((a, g) => a + tg(g), 0), x => sayi(Math.round(x)) + " TL")}</div>`;
}
function gsDersCiz(L, D7) {
  const R = {};
  const yaz = d => /[a-zçğıöşü]/.test(d || "") ? d : null;   // tamamı büyük harf yazılmış eski adı göstermemek için
  for (const x of L) { const k = dersGenelK(x.ders), ad = dersGenel(x.ders), r = R[k] ||= { ders: ad, gon: 0, yeterli: 0, yetersiz: 0, odeme: 0, odeme_n: 0 }; if (yaz(ad) && !yaz(r.ders)) r.ders = ad; r.gon++; if (x.deg === "yeterli" || x.deg === "yetersiz") r[x.deg]++; const t = gsUcret(x.ders).tl; if (t != null) { r.odeme += t; r.odeme_n++; } }
  const E = {}; for (const x of D7) { const a = E[dersGenelK(x.ders)] ||= { ornek: 0, ornek_gon: 0, ders: dersGenel(x.ders) }; a.ornek += x.ornek || 0; a.ornek_gon += x.ornek_gon || 0; }

  const S = Object.values(R).sort((a, b) => b.gon - a.gon || (E[dersGenelK(b.ders)]?.ornek || 0) - (E[dersGenelK(a.ders)]?.ornek || 0)).slice(0, 12);
  const g = (gsV.Z.ucret || {})._genel || {};
  $("#gs-ders").innerHTML = `<div class="gs-bas"><h3 data-ipucu="Sınıflar birleşik; tasarruf %20 stopaj dahil">Ders bazında tasarruf</h3></div>
    ${S.length ? `<table class="tablo sik gs-tablo"><tr><th>Ders</th><th>Gönderilen</th><th data-ipucu="Öğretmene ödenen ortalama (stopajsız)">Soru başı</th><th data-ipucu="Soru başı × gönderilen × 1,20">Tasarruf</th><th data-ipucu="Yeterli / yetersiz">✓ / ✗</th>${D7.length ? '<th data-ipucu="Son 7 günde bakılanların yüzde kaçına cevap gitti">Eşleşme 7g</th>' : ""}</tr>
    ${S.map(x => { const sb = x.odeme_n ? x.odeme / x.odeme_n : null, ek = E[dersGenelK(x.ders)], o = ek?.ornek >= 9 ? ek.ornek_gon / ek.ornek : null, zayif = o != null && o < .05;
      return `<tr class="${zayif ? "gs-zayif" : ""}"><td title="${e(x.ders)}">${e(x.ders)}</td><td>${x.gon}</td>
        <td ${sb == null ? "" : `title="${x.odeme_n} cevabın ortalaması"`}>${sb == null ? '<span class="soluk">ölçülüyor</span>' : tlStr(sb)}</td>
        <td><b>${sb == null ? "—" : tlStr(x.odeme * (1 + STOPAJ))}</b></td><td>${x.yeterli} / ${x.yetersiz ? `<b class="gs-kirmizi">${x.yetersiz}</b>` : 0}</td>${D7.length ? `<td>${o == null ? "—" : "%" + Math.round(o * 100)}</td>` : ""}</tr>`; }).join("")}</table>
    <p class="soluk gs-dip">Genel ortalama ${g.ort ? tlStr(g.ort) + ` (${g.n} örnek)` : "ölçülüyor"} · turuncu satır: bankanın zayıf kaldığı ders</p>` : '<p class="soluk">Bu aralıkta gönderilen cevap yok.</p>'}`;
}
// 24 Eki: öğrenci yorumlarına yazdığımız yanıtlar. Bekleyen = gönderici kuyruğu (dakikada 1 gider), gönderilen = gitmiş yanıtlar.
// 25 Eki: yorum akışı sohbet gibi — öğrenci solda gri, biz sağda mor; değerlendirme notu öğrenci balonunda etiketli
function gsIplik(x, ek = [], degEkle = true) {
  const Y = [...(x?.yorumlar || [])], bas = t => String(t || "").slice(0, 40);
  // gönderdiğimiz yanıt admin'den henüz geri okunmadıysa gönderim kaydından ekle
  if (x?.soru_id) for (const g of ((gsV.Z.yorum || {}).gonderilen || [])) if (g.soru == x.soru_id && !Y.some(y => y.kim === "biz" && bas(y.metin) === bas(g.yanit))) Y.push({ kim: "biz", metin: g.yanit, zaman: g.zaman, ad: g.hesap });
  if (degEkle && x?.deg_metin && x.deg === "yetersiz" && !Y.some(y => y.kaynak === "degerlendirme")) Y.push({ kim: "ogrenci", metin: x.deg_metin, zaman: x.deg_zaman || x.zaman, kaynak: "degerlendirme" });
  Y.sort((a, b) => (a.zaman || "") < (b.zaman || "") ? -1 : 1);
  const ilk = s => String(s || "").split(/\s+/)[0];
  const balon = y => `<div class="gs-bl ${y.kim === "biz" ? "biz" : "ogr"} ${y.bekliyor ? "bek" : ""}"><div class="gs-bl-bas">${y.kim === "biz" ? `Biz${y.ad ? " · " + e(ilk(y.ad)) : ""}` : e(y.ad ? ilk(y.ad) : "Öğrenci")}${y.kaynak === "degerlendirme" ? ' <span class="gs-bl-et">değerlendirme</span>' : ""}${y.bekliyor ? ' <span class="gs-bl-et">gönderilecek</span>' : ""} · ${y.zaman ? tarih(y.zaman) : "sırada"}</div><div class="gs-bl-m">${e(String(y.metin || "").replace(/^(Değerlendirme notu|Değerlendirme): /, ""))}</div></div>`;
  return `<div class="gs-sohbet">${[...Y, ...ek].map(balon).join("") || '<p class="soluk">Henüz yorum yok.</p>'}</div>`;
}
function gsSoruAc(q) {
  const x = (gsV.C || []).find(c => c.soru_id == q);
  if (!x) return window.open(`${ADMIN}/Question/Detail/${q}`, "_blank", "noopener");
  gsPencere(`Soru ${q} <a class="gs-p-admin" href="${ADMIN}/Question/Detail/${q}" target="_blank" rel="noopener">admin'de aç ↗</a>`, `<div class="gs-kartlar tek">${gsKart(x)}</div>`);
}
function gsYorumlarCiz(Y) {
  const yer = $("#gs-yorumlar"); if (!yer) return;
  const K = Y.kuyruk || [], G = Y.gonderilen || [], bek = gsYorSek === "bekleyen";
  const gor = new Set(), L = (bek ? K : G).filter(y => { if (!bek && gor.has(y.soru)) return false; gor.add(y.soru); return true; });
  const C = gsV.C || [];
  const sat = y => { const x = C.find(c => c.soru_id == y.soru);
    const ek = bek ? [{ kim: "biz", metin: y.yanit, bekliyor: true, ad: y.hesap }] : [];
    const yedek = x ? null : [{ kim: "ogrenci", metin: y.ogrenci || "", zaman: y.ogrenci_zaman }, { kim: "biz", metin: y.yanit, zaman: y.zaman, ad: y.hesap }].filter(z => z.metin);
    return `<div class="gs-ys"><div class="gs-ys-bas"><a href="#" class="gs-soru-ac" data-q="${y.soru}">Soru ${y.soru}</a><span class="soluk">${y.ders ? e(dersGenel(y.ders)) : ""}</span>${y.hesap ? `<span class="etiket">${e(y.hesap)}</span>` : ""}</div>
      ${x ? gsIplik(x, ek) : gsIplik({ yorumlar: yedek }, ek)}</div>`; };
  const U = (Y.uygunsuz || []).filter(u => (Date.now() - new Date(u.t)) < 7 * 864e5);
  const uyg = U.length ? `<div class="gs-uyg"><b>Uygunsuz yorum · ${U.length}</b> <span class="soluk">Yanıt yazılmadı. Öğrencinin kurumuna bildirilmeli.</span>${U.slice(-5).reverse().map(u => `<div><a href="#" class="gs-soru-ac" data-q="${u.soru}">Soru ${u.soru}</a> · ${tarih(u.t)} — “${e(u.metin)}”</div>`).join("")}</div>` : "";
  yer.innerHTML = uyg + `<div class="gs-bas"><h3 data-ipucu="Bekleyenler dakikada bir gider">Yorum yanıtları</h3><span class="cipler">${[["bekleyen", `Bekleyen ${Y.kuyruk_n ?? K.length}`], ["gonderilen", `Gönderilen · bugün ${Y.gonderilen_bugun || 0}`]].map(([v, a]) => `<button class="cip ${gsYorSek === v ? "secili" : ""}" data-v="${v}">${a}</button>`).join("")}</span></div>
    <div class="gs-ys-liste">${L.length ? L.slice(0, 40).map(sat).join("") : `<p class="soluk">${bek ? "Bekleyen yanıt yok." : "Henüz gönderilen yanıt yok."}</p>`}</div>`;
  yer.querySelectorAll(".cip").forEach(b => b.onclick = () => { gsYorSek = b.dataset.v; gsYorumlarCiz(Y); });
}
document.addEventListener("click", ev => { const a = ev.target.closest && ev.target.closest(".gs-soru-ac"); if (!a) return; ev.preventDefault(); gsSoruAc(a.dataset.q); });
function gsYorumCiz(Y) {
  const L = (Y.son || []).slice(0, 6);
  $("#gs-yorum").innerHTML = `<div class="gs-bas"><h3>Öğrenci yorumları</h3></div><p class="gs-acikla">Gelen <b>${Y.gelen || 0}</b> yorum, verilen <b>${Y.yanit || 0}</b> yanıt · bugün ${Y.gelen_bugun || 0} yorum, ${Y.yanit_bugun || 0} yanıt</p>
    ${L.length ? L.map(y => `<div class="gs-yor ${y.kim}"><span class="soluk">${tarih(y.zaman)} · ${y.kim === "biz" ? "bizim yanıt" : "öğrenci"} · ${soruLink(y.soru, "soru " + y.soru)}</span><div class="klamp">${e(y.metin)}</div></div>`).join("") : '<p class="soluk">Henüz yorum yok.</p>'}`;
}
// 25 Eki: ipucu kutusu sayfa katmanında; tablo ya da kaydırma kutusunun içinde kırpılmaz, ekran kenarında ters yöne açılır
(() => {
  const t = document.createElement("div"); t.id = "ipucu-k"; document.body.appendChild(t); let hedef = null;
  const kapat = () => { hedef = null; t.classList.remove("acik"); };
  document.addEventListener("mouseover", ev => {
    const h = ev.target.closest ? ev.target.closest("[data-ipucu]") : null; if (h === hedef) return;
    if (!h || !h.dataset.ipucu) return kapat();
    hedef = h; t.textContent = h.dataset.ipucu; t.classList.add("acik");
    const r = h.getBoundingClientRect(), w = t.offsetWidth, y0 = t.offsetHeight;
    let x = Math.min(Math.max(8, r.left), innerWidth - w - 8), y = r.bottom + 6; if (y + y0 > innerHeight - 8) y = Math.max(8, r.top - y0 - 6);
    t.style.left = x + "px"; t.style.top = y + "px";
  });
  addEventListener("scroll", kapat, true); addEventListener("click", kapat, true);
})();
window.git = git;
sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT") girisGoster(); });
basla();
