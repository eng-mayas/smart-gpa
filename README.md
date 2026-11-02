# Smart GPA – حاسبة المعدل الجامعي الذكية ومتنبّئ الاستنفاذ الأكاديمي

**تم تطوير التطبيق بواسطة Atmata Group (أتمتة غروب) — Automating Tomorrow.** الشعار في `public/atmata-logo.png`، وألوان الهوية (أزرق `#1060a8` وذهبي `#e8a850`) في `src/ui/styles.css`.

تطبيق ويب عربي (RTL) يساعد طلاب الجامعات على حساب المعدل الفصلي والتراكمي، توقع المعدل، ومتابعة الإنذارات الأكاديمية ومخاطر الاستنفاذ وفق **محرك قواعد أكاديمي قابل للتهيئة**.

> ⚖️ التطبيق أداة مساعدة على اتخاذ القرار فقط. السياسة المضمّنة **مسودة** مستخرجة من مخطط يدوي وتحتاج مطابقة مع اللائحة الرسمية. لا يُصدر التطبيق قرارات أكاديمية رسمية.

## التشغيل

```bash
npm install          # React 19, esbuild, TypeScript, tsx
npm run dev          # خادم تطوير مع إعادة بناء تلقائية (يطبع الرابط)
npm run build        # يبني dist/ (ملف HTML + JS + CSS جاهزة للنشر على أي استضافة ثابتة)
npm test             # اختبارات الوحدة (node:test عبر tsx)
npm run typecheck    # فحص الأنواع (يتطلب @types/react بعد npm install)
node scripts/smoke.mjs   # اختبار دخاني في متصفح headless (يتطلب playwright)
```

لا يحتاج التطبيق إلى خادم خلفي: كل الحسابات تجري في المتصفح، والبيانات تُحفظ في `localStorage` (وضع الضيف) مع تصدير/استيراد JSON.

## البنية

```
src/
  core/               طبقة الحساب — TypeScript خالص بلا React، مغطّاة بالاختبارات
    grading.ts        سلالم العلامات (مئوي ↔ حرفي ↔ نقاط) — بيانات قابلة للتهيئة
    gpa.ts            المعدل الفصلي والتراكمي، الإعادة، الانسحاب، ناجح/راسب، صفر ساعة
    predictor.ts      حاسبة الهدف، جدوى الهدف، خطط بديلة، سيناريوهات، أثر المقررات، أدنى علامات
    rules.ts          محرك القواعد: آلة حالات منتهية (FSM) + سياسات مُصدَّرة بإصدارات
    format.ts         تقريب العرض فقط (الحساب الداخلي بدقة كاملة)
  state/
    store.tsx         الحالة + طبقة التخزين (localStorage) — قابلة للاستبدال بـ Supabase
    useAcademic.ts    اشتقاق كل النتائج من الحالة (hook واحد تستخدمه الصفحات)
  ui/
    App.tsx           القائمة الجانبية + التوجيه (hash routing) + الثيم واللغة
    pages/            9 صفحات: لوحة التحكم، فصلي، تراكمي، توقع، تجنب الاستنفاذ، إنذارات، سجل، أنظمة، إعدادات
    components/       جدول المقررات، مؤشرات، رسوم SVG (خط/أعمدة/عداد دائري)
    styles.css        نظام تصميم بمتغيرات CSS (فاتح/داكن، RTL)
tests/core.test.ts    30 اختباراً: حدود التحويل، المعدل الموزون، التراكمي، الإعادة، الهدف المستحيل، انتقالات FSM...
samples/              سجلات أكاديمية تجريبية للاستيراد من صفحة الإعدادات
build.mjs             سكربت البناء (esbuild)
```

### لماذا esbuild + CSS بدل Vite + Tailwind + Recharts؟
بُني المشروع في بيئة بلا وصول إلى سجل npm، فاعتمد على ما هو متاح محلياً. الطبقات مفصولة بحيث يمكن:
- استبدال `build.mjs` بـ Vite بلا تغيير في `src/`.
- استبدال `styles.css` بـ Tailwind/shadcn تدريجياً (الأصناف دلالية: `.card`, `.btn`, `.badge`...).
- استبدال رسوم SVG في `components/common.tsx` بـ Recharts بالواجهة نفسها.

## محرك القواعد (FSM)

الحالات: `not_evaluated → good | warning_1 | warning_2 | remedial_short | remedial_long | exception | dismissed_specialization | dismissed_university`

السياسة الافتراضية `DRAFT_SY_PRIVATE_POLICY` (من المخطط المقدّم):

| الحالة الحالية | ≥ 2.00 | 1.50–1.99 | 1.00–1.49 | < 1.00 |
|---|---|---|---|---|
| سليم / بداية (نهاية ف2) | سليم | إنذار 1 | إنذار 1 | فصل من التخصص |
| إنذار 1 | سليم | إنذار 2 | إنذار 2 | فصل من التخصص |
| إنذار 2 | سليم | فصلان استدراكيان | فصل استدراكي واحد | فصل من التخصص |
| استدراكي قصير | سليم | فصل استدراكي إضافي | فصل من التخصص | فصل من التخصص |
| آخر فصل استدراكي | سليم | استثناء (≥99 ساعة و≥1.75) وإلا فصل من الجامعة | فصل من الجامعة | فصل من التخصص |

كل حقل في `AcademicPolicy` قابل للتعديل: `goodStandingMin`, `specializationDismissalBelow`, `maxWarnings`, `upperRecoveryMin`, `longRemedialSemesters`, `shortRemedialSemesters`, `exception`, `verification`, `sourceRef`, `effectiveFrom`, `version`...

لإضافة جامعة: أضف كائناً إلى `POLICIES` في `rules.ts` وسلّماً إلى `SCALES` في `grading.ts`. الإصدارات القديمة تبقى محفوظة.

## الصيغ

- المعدل الفصلي = Σ(نقاط × ساعات) ÷ Σ(ساعات الداخلة في المعدل)
- التراكمي الجديد = [(التراكمي السابق × ساعاته) + Σ نقاط الفصل − Σ نقاط المحاولات المستبدلة] ÷ (الساعات السابقة + ساعات الفصل − الساعات المستبدلة)
- المعدل الفصلي المطلوب للهدف T = [T × (H + h) − G × H] ÷ h
- الساعات اللازمة بمعدل ثابت g للوصول إلى T = (T − G) × H ÷ (g − T)  (مستحيل إذا g ≤ T)

## خارطة الطريق
- [x] المرحلة 1: الواجهة + الفصلي والتراكمي
- [x] المرحلة 2: المحاكي وحاسبة الهدف
- [x] المرحلة 3: محرك الإنذار والاستنفاذ
- [x] المرحلة 4: الملف الأكاديمي والسجل ولوحات التحليل
- [~] المرحلة 5: إدارة السياسات من الواجهة (حالياً عبر الكود/JSON)، Supabase للحسابات، ترجمة إنكليزية كاملة

## تطبيق موبايل (PWA ثم المتاجر)

### 1) PWA — قابل للتثبيت فوراً من المتصفح (مضمّن)
المشروع يحوي `public/manifest.webmanifest` و`public/sw.js` (عمل دون اتصال) وأيقونات 192/512 maskable. يكفي رفع مجلد `dist/` على استضافة HTTPS (Netlify، Vercel، Cloudflare Pages، GitHub Pages) وسيظهر خيار «إضافة إلى الشاشة الرئيسية» على Android وiOS.
> عند كل إصدار جديد غيّر قيمة `CACHE` في `sw.js`.

### 2) تطبيق أصلي للمتاجر عبر Capacitor
```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios @capacitor/splash-screen @capacitor/status-bar
npm run build
npx cap add android      # يتطلب Android Studio + JDK 17
npx cap add ios          # يتطلب macOS + Xcode
npx cap sync
npx cap open android     # ثم Build › Generate Signed Bundle (AAB) للنشر على Google Play
npx cap open ios         # ثم Product › Archive للنشر على App Store
```
`capacitor.config.ts` جاهز بـ `appId = com.atmata.smartgpa`. بعد أي تعديل في الكود: `npm run build && npx cap sync`.

### متطلبات النشر
- **Google Play**: حساب مطوّر (25$ مرة واحدة)، توقيع AAB بمفتاح keystore، سياسة خصوصية (التطبيق لا يرسل بيانات — كل شيء محلي)، لقطات شاشة، تصنيف المحتوى.
- **App Store**: حساب Apple Developer (99$/سنة)، Xcode على macOS، أيقونة 1024×1024، مراجعة Apple (تُفضّل أن يقدّم التطبيق قيمة تفوق «موقع ملفوف» — المحاكي ومحرك الإنذارات يحققان ذلك).

## توزيع تطبيق Android مباشرة (بدون Google Play)

**الطريقة الموصى بها — بناء تلقائي على GitHub (لا يحتاج Android Studio):**
1. ارفع المشروع إلى مستودع GitHub (الفرع `main`).
2. يعمل `.github/workflows/android-apk.yml` تلقائياً ويُنتج `SmartGPA.apk` في تبويب **Actions → آخر تشغيل → Artifacts**.
3. (اختياري لكنه مهم للتحديثات) أنشئ مفتاح توقيع مرة واحدة بـ `scripts/make-keystore.sh` وأضف الأسرار `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` في Settings → Secrets. بدونها يُبنى APK بتوقيع debug يعمل أيضاً.
4. وزّع ملف الـ APK عبر رابط/تلغرام/واتساب/موقع الجامعة. على هاتف الطالب: فتح الملف → السماح بـ «التثبيت من مصادر غير معروفة» لمرة واحدة.

**بناء محلي:** `scripts/build-apk-local.sh` (يتطلب Android SDK + JDK 17).

**iOS بدون App Store:** التوزيع الحر غير ممكن على iPhone؛ البدائل: PWA (إضافة إلى الشاشة الرئيسية من Safari) أو TestFlight (حتى 10,000 مختبِر، يحتاج حساب Apple Developer).
