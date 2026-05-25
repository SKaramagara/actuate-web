# Actuate — Deployment Checklist

## Repo Yapısı (deploy/ klasörünün içeriği)

```
/
├── index.html                    ← EN ana sayfa
├── tr/
│   └── index.html                ← TR ana sayfa
├── assets/                       ← Görseller buraya kopyalanacak
│   ├── ActuateAlogo.png
│   ├── ActuateSiyahZemin.png
│   ├── bg-manufacturingW.webp
│   ├── bg-sustainabilityW.webp
│   ├── bg-smartcityB.webp
│   ├── bg-smartcityW.webp
│   ├── bg-healthcareB.webp
│   ├── bg-healthcareW.webp
│   ├── bg-agricultureB.webp
│   ├── bg-agricultureW.webp
│   └── bg-technologyW.webp
├── staticwebapp.config.json
└── api/
    ├── package.json
    └── contact/
        ├── index.js
        └── function.json
```

---

## Azure Portal — Adım Adım

### 1. Azure Communication Services

1. Portal → Create → `Communication Services`
2. Resource group: `actuate-prod`
3. Name: `actuate-acs`
4. Sol menü → **Email** → **Domains** → Add domain
5. Domain type: **Custom domain** → `actuate.com.tr`
6. DNS kayıtlarını ekle (portal gösteriyor):
   - TXT (domain doğrulama)
   - CNAME (DKIM)
   - TXT (SPF): `v=spf1 include:spf.protection.outlook.com ~all` ile merge et
7. **Mail from address**: `no-reply@actuate.com.tr`
8. Sol menü → **Keys** → Connection string'i kopyala

### 2. Azure Storage Account

1. Portal → Create → `Storage Account`
2. Name: `actuateprod` (küçük harf, harf+rakam)
3. Redundancy: **LRS** (Locally Redundant — yeterli ve en ucuz)
4. Sol menü → **Tables** → `+ Table` → Name: `ContactSubmissions`
5. Sol menü → **Access keys** → Connection string'i kopyala

### 3. Azure Static Web Apps

1. Portal → Create → `Static Web App`
2. Plan: **Free**
3. GitHub organization: actuate (veya ilgili org)
4. Repository: `actuate-web`
5. Branch: `main`
6. Build preset: **Custom**
   - App location: `/`
   - Api location: `api`
   - Output location: *(boş bırak)*
7. Create → GitHub Actions workflow otomatik oluşturulur

### 4. Environment Variables (Zorunlu)

Portal → Static Web App → **Configuration** → Application Settings:

| Name | Value |
|---|---|
| `STORAGE_CONNECTION_STRING` | Storage Account'tan kopyalanan connection string |
| `ACS_CONNECTION_STRING` | Communication Services'tan kopyalanan connection string |
| `ALLOWED_ORIGIN` | `https://actuate.com.tr` |

### 5. Custom Domain

Portal → Static Web App → **Custom domains** → Add:
- `actuate.com.tr` → CNAME veya ALIAS kaydı ekle

---

## Test

Form gönderdikten sonra:
1. Azure Portal → Storage Account → Tables → `ContactSubmissions` → kayıt görünmeli
2. `info@actuate.com.tr` → email gelmeli

## Maliyet Tahmini (Aylık)

| Servis | Beklenen Kullanım | Maliyet |
|---|---|---|
| Static Web Apps Free | 100 GB/ay dahil | **$0** |
| ACS Email | <100 email/gün | **$0** |
| Table Storage | ~1 MB/ay | **~$0.00** |
| **TOPLAM** | | **$0** |
