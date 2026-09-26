# Öğretmen itirazı → destek paneli (Tebeşir entegrasyonu için sözleşme)

Tebeşir bir öğretmen itirazı aldığında destek panelinin Supabase projesine (`rbjrnevngfuribasrnph`) tek bir RPC çağırır:

```
POST https://rbjrnevngfuribasrnph.supabase.co/rest/v1/rpc/d_itiraz_ekle
apikey: <destek paneli publishable/anon anahtarı>
Content-Type: application/json

{"p_anahtar": "<ITIRAZ_ANAHTARI>", "p_ogretmen_id": 123456, "p_metin": "itirazın metni",
 "p_sikayet_no": 1351234,      // biliniyorsa cevap şikayetinin numarası
 "p_question_id": 1326900}     // ya da sorunun numarası (şikayet bundan bulunur)
→ itiraz kaydının id'si
```

- `ITIRAZ_ANAHTARI` Mac'te `~/.config/tahta/itiraz.env` içinde; Tebeşir'e sunucu tarafı gizli değişken olarak verilir (tarayıcıya asla).
- Fonksiyon yalnız ekleme yapar; Tebeşir itirazları okuyamaz, başka tabloya dokunamaz. Öğretmen başına günde en çok 5 itiraz.
- Hatalar: `yetkisiz` (anahtar yanlış), `eksik` (öğretmen ya da metin yok), `cok_fazla` (günlük sınır).
- Tebeşir tarafında toplanması gerekenler: öğretmenin id'si, itiraz edilen sorunun ya da şikayetin numarası, gerekçe metni.

Sonraki adım (itirazlar gelmeye başlayınca): panelde "İtirazlar" sayfası (orijinal karar + gerekçe + itiraz yan yana),
HAKLI kararı kural dosyasına "bu karar yanlıştı" olarak yazılır ve gerekiyorsa admin'de düzeltilir.
