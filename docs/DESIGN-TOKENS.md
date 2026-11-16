# TradingView Android — Dizayn tokenlari (o‘lchangan ma’lumotlar)

> **Manba:** `tradingview-1-20-87-0-1002595.xapk` → `com.tradingview.tradingviewapp.apk`
> **Versiya:** 1.20.87.0 (versionCode 1002595) · paket `com.tradingview.tradingviewapp`
> **Holat:** APK **ishga tushirilmagan**, o‘rnatilmagan. Barcha raqamlar `resources.arsc`, `res/**/*.xml` (binary AXML) va `res/font/*.ttf` fayllaridan statik dekod qilindi.

Ushbu hujjat demo chart uchun kerak bo‘ladigan **aniq ranglar, o‘lchamlar, shriftlar va ikonkalar**ni beradi. Har bir qiymat yonida qayerdan olingani ko‘rsatilgan. **Taxmin qilingan qiymatlar** alohida "CHEKLOVLAR" bo‘limida sanab o‘tilgan — ularni fakt sifatida ishlatmang.

---

## 1. Qisqa xulosa

| Ko‘rsatkich | Natija |
|---|---|
| Dekod qilingan resurs jadvali | `resources.arsc` 7.4 MB, 15 963 resurs, 22 tur |
| Rang resurslari | 1 261 ta (`color`), shundan **766 tasi aniq `#AARRGGBB`** ga yechildi |
| Dimensiyalar | 1 494 ta (`dimen`), 1 254 tasi aniq qiymat |
| String resurslari | 3 239 ta (asbob nomlari shu yerda) |
| Style/theme | 1 454 ta; asosiy 2 tasi (`DsAppTheme`, `DsAppTheme.Dark`) to‘liq ochildi |
| Shriftlar | 7 ta TTF (`res/font/`) |
| Ikonkalar | 124 ta PNG + 124 ta SVG (94 chizish asbobi + 30 UI) |
| Ikonka o‘lchami | `drawing_tools_icon_size` = **28dp** (chizish asboblari); UI ikonkalar 24dp |

**Eng muhim topilma:** ilovaning butun dizayn tizimi ikkita theme ichida — `DsAppTheme` (light) va `DsAppTheme.Dark` (dark) — 257 tagacha token bilan yig‘ilgan (`dsBackgroundColor*`, `dsContentColor*`, `dsFillColor*`, `dsBorderColor*`, `dsOverlayColor*`). Bu — TradingView’ning haqiqiy dizayn tizimi, taxmin emas.

---

## 2. Metodologiya (qanday olindi)

| Qadam | Vosita | Izoh |
|---|---|---|
| XAPK → APK | PowerShell `System.IO.Compression` | `base.apk` 114 755 510 bayt |
| APK ichidagi resurslar | Python `zipfile` | 4 418 entry: 8×`classes.dex`, `resources.arsc`, `res/` |
| `resources.arsc` dekod | **androguard 4.1.4** (venv) | `ARSCParser` + o‘z `Res_value` dekoderim |
| Binary AXML (layout/drawable/color) | androguard `AXMLPrinter` | Matnga aylantirildi |
| VectorDrawable → SVG | o‘z konverterim | `pathData`, `fillColor`, `group`, `clip-path` |
| SVG → PNG | **skia-python 144.1** | 112 px (28dp ×4) |
| Kontakt-sheet | **Pillow 13** | `sheet.png` |

`aapt2` / `aapt` / Android SDK bu mashinada **yo‘q** (`ANDROID_HOME` bo‘sh, `%LOCALAPPDATA%\Android\Sdk` mavjud emas), shuning uchun androguard ishlatildi. Virtual muhit: `D:\Project\AI\tvclone\work\venv`.

---

## 3. Ranglar

### 3.1. Top-22 rang — dark tema (`DsAppTheme.Dark`, aniq o‘lchangan)

"Token" — `resources.arsc` dagi ilova `attr` nomi; "Hex (dark)" — shu attr’ning `DsAppTheme.Dark` dagi qiymati; "Hex (light)" — `DsAppTheme` dagi qiymati.

| # | Token | Hex (dark) | Hex (light) | Ma’nosi | Qayerdan |
|---|---|---|---|---|---|
| 1 | `dsBackgroundColorSecondaryNeutralLight` | `#FF000000` | `#FFF2F2F2` | Ilova asosiy foni (dark) | `DsAppTheme.Dark` style item |
| 2 | `dsBackgroundColorSecondaryNeutralExtraLight` | `#FF0F0F0F` | `#FFF9F9F9` | Panel / bar foni | `DsAppTheme.Dark` style item |
| 3 | `dsBackgroundColorPrimaryNeutralExtraLight` | `#FF1F1F1F` | `#FFF9F9F9` | Yuza (surface) | `DsAppTheme.Dark` style item |
| 4 | `dsBackgroundColorPrimaryNeutralLight` | `#FF2E2E2E` | `#FFF2F2F2` | Ko‘tarilgan yuza | `DsAppTheme.Dark` style item |
| 5 | `dsBackgroundColorPrimaryNeutralNormal` | `#FF3D3D3D` | `#FFEBEBEB` | Tanlangan / aktiv yuza | `DsAppTheme.Dark` style item |
| 6 | `dsBackgroundColorPrimaryNeutralBold` | `#FF4A4A4A` | `#FF2E2E2E` | Kuchli chegara yuza | `DsAppTheme.Dark` style item |
| 7 | `dsFillColorPrimaryNeutralThin` | `#FF1F1F1F` | `#FFF9F9F9` | Nozik chiziq (grid/skeleton) | `DsAppTheme.Dark` style item |
| 8 | `dsFillColorPrimaryNeutralNormal` | `#FF4A4A4A` | `#FFDBDBDB` | Ajratgich (divider) | `DsAppTheme.Dark` style item |
| 9 | `dsColorPanelBorderCard` | `#FF4A4A4A` | `#FFF2F2F2` | Panel/karta chegarasi | `DsAppTheme.Dark` style item |
| 10 | `dsContentColorPrimaryNeutralBold` | `#FFDBDBDB` | `#FF0F0F0F` | Asosiy matn | `DsAppTheme.Dark` style item |
| 11 | `dsContentColorPrimaryNeutralSemiBold` | `#FFB8B8B8` | `#FF4A4A4A` | Ikkilamchi matn | `DsAppTheme.Dark` style item |
| 12 | `dsContentColorPrimaryNeutral` | `#FF8C8C8C` | `#FF707070` | Uchinchi darajali matn (axis) | `DsAppTheme.Dark` style item |
| 13 | `dsContentColorPrimaryNeutralNormal` | `#FF707070` | `#FF8C8C8C` | O‘chirilgan (disabled) matn | `DsAppTheme.Dark` style item |
| 14 | `dsContentColorPrimaryAccent` | `#FF2962FF` | `#FF2962FF` | Brend aksenti (TradingView ko‘k) | `DsAppTheme.Dark` style item |
| 15 | `dsContentColorPrimarySuccess` | `#FF089981` | `#FF089981` | Success yashil | `DsAppTheme.Dark` style item |
| 16 | `dsContentColorPrimaryPositive` | `#FF22AB94` | `#FF06806B` | O‘sish / up (mint) | `DsAppTheme.Dark` style item |
| 17 | `dsContentColorPrimaryNegative` | `#FFF7525F` | `#FFCC2F3C` | Tushish / down (qizil) | `DsAppTheme.Dark` style item |
| 18 | `dsContentColorPrimaryDanger` | `#FFF23645` | `#FFF23645` | Danger qizil | `DsAppTheme.Dark` style item |
| 19 | `dsContentColorPrimaryWarning` | `#FFFF9800` | `#FFFF9800` | Ogohlantirish (orange) | `DsAppTheme.Dark` style item |
| 20 | `dsOtherColorModalBackground` | `#66111111` | `#669C9C9C` | Modal overlay | `DsAppTheme.Dark` style item |
| 21 | `dsOtherColorShadowPrimaryNeutralExtraHeavy` | `#A8000000` | `#54000000` | Soya (shadow) | `DsAppTheme.Dark` style item |
| 22 | `dsOverlayColorAccent1Normal` | `#4D448AFF` | `#4D2962FF` | Tanlash overlay (accent) | `DsAppTheme.Dark` style item |

### 3.2. Yakka `color` resurslari (chart uchun muhimlari)

| Resurs nomi (`res/values/colors`) | Hex | Izoh |
|---|---|---|
| `dsColorPaletteText` | (dark) `#FFDBDBDB` / (light) `#FF0F0F0F` | Ikonka/aksiya rangi (theme attr). Dark `#FFDBDBDB`, light `#FF0F0F0F` — barcha chizish asbobi ikonkalari shu rangda |
| `color_success` | `#FF089981` | Success yashil (light/dark bir xil) |
| `color_danger` | `#FFF7525F` | Danger qizil |
| `color_danger_pressed` | `#FFF23645` | Danger bosilgan holati |
| `line_chart_background_gradient_start_color` | `#33000000` | Line chart fon gradienti boshlanishi (alpha 33) |
| `line_chart_background_gradient_end_color` | `#00000000` | Line chart fon gradienti oxiri (to‘liq shaffof) |
| `panel_shadow` | `#4A000000` | Panel soyasi (alpha 4A) |
| `color_tutorial_overlay_background` | `#E61D1D1D` | Tutorial overlay foni (alpha E6) |
| `market_active_background_color` | `#2624B29B` | Bozor ochiq badge foni (alpha 26) |
| `market_closed_background_color` | `#269C9C9C` | Bozor yopiq badge foni |
| `post_market_background_color` | `#262962FF` | Post-market badge foni |
| `pre_market_background_color` | `#26FB8C00` | Pre-market badge foni |
| `market_delayed_background_color` | `#26FFA726` | Delayed data badge foni |

### 3.3. Demo chart uchun to‘g‘ridan-to‘g‘ri ishlatiladigan mapping (dark)

| Maqsad | Token | Hex |
|---|---|---|
| Chart/fon (eng qorong‘i) | `dsBackgroundColorSecondaryNeutralLight` | `#FF000000` |
| Panel va toolbar foni | `dsBackgroundColorSecondaryNeutralExtraLight` | `#FF0F0F0F` |
| Yuza / karta | `dsBackgroundColorPrimaryNeutralExtraLight` | `#FF1F1F1F` |
| Ko‘tarilgan yuza (popup) | `dsBackgroundColorPrimaryNeutralLight` | `#FF2E2E2E` |
| Tanlangan asbob foni | `dsBackgroundColorPrimaryNeutralNormal` | `#FF3D3D3D` |
| Grid chizig‘i (nozik) | `dsFillColorPrimaryNeutralThin` | `#FF1F1F1F` |
| Divider / ajratgich | `dsFillColorPrimaryNeutralNormal` | `#FF4A4A4A` |
| Matn — asosiy | `dsContentColorPrimaryNeutralBold` | `#FFDBDBDB` |
| Matn — ikkilamchi (label) | `dsContentColorPrimaryNeutralSemiBold` | `#FFB8B8B8` |
| Matn — tertiary (axis) | `dsContentColorPrimaryNeutral` | `#FF8C8C8C` |
| Up / bullish | `dsContentColorPrimaryPositive` | `#FF22AB94` |
| Down / bearish | `dsContentColorPrimaryNegative` | `#FFF7525F` |
| Aksent / tanlash | `dsContentColorPrimaryAccent` | `#FF2962FF` |

### 3.4. Ranglar bo‘yicha qamrov

| Ko‘rsatkich | Soni |
|---|---|
| `color` turidagi resurs | 1 261 |
| Aniq `#AARRGGBB` ga yechildi | 766 |
| Yechilmadi (reference / ColorStateList) | 495 |

Yechilmaganlar asosan `ColorStateList` (`res/color/*.xml`) yoki boshqa resursga havola qiluvchi selektorlardir — ular holatga (pressed / selected / disabled) qarab rang beradi. Ularni bitta hex’ga keltirib bo‘lmaydi.

---

## 4. O‘lchamlar (`dimen`)

### 4.1. Chart ekrani — bevosita o‘lchangan

| Resurs | Qiymat | Izoh |
|---|---|---|
| `chart_panel_height` | **52dp** | Chart ustki paneli balandligi |
| `chart_panel_toolbar_margin` | **12dp** | Panel ichidagi toolbar margini |
| `chart_panel_separator_width` | **1dp** | Ajratgich kengligi |
| `chart_panel_separator_height` | **24dp** | Ajratgich balandligi |
| `chart_panel_symbol_icon_size` | **20dp** | Symbol ikonkasi |
| `chart_panel_symbol_item_height` | **24dp** | Symbol qatori balandligi |
| `chart_panel_symbol_interval_width` | **52dp** | Interval tugmasi kengligi |
| `chart_iv_panel_action_size` | **24dp** | Panel action ikonkasi |
| `chart_ll_panel_action_width` | **40dp** | Panel action kengligi |
| `chart_ll_panel_action_height` | **40dp** | Panel action balandligi |
| `chart_label_background_corner_radius` | **4dp** | Chart label radiusi |
| `chart_label_background_internal_horizontal_padding` | **3dp** | Label gorizontal padding |
| `chart_label_background_internal_vertical_padding` | **4dp** | Label vertikal padding |
| `chart_panel_time_picker_date_size` | **34sp** | Vaqt tanlash matni |
| `bottom_tab_layout_size` | **52dp** | Pastki tab bar balandligi |
| `bottom_tab_layout_with_divider_size` | **53dp** | Pastki tab bar (divider bilan) |

### 4.2. Umumiy UI

| Resurs | Qiymat | Izoh |
|---|---|---|
| `button_height` | **40dp** | Oddiy tugma balandligi |
| `button_compact_height` | **36dp** | Kompakt tugma |
| `button_thin_height` | **32dp** | Yupqa tugma |
| `button_corner_radius` | **12dp** | Tugma radiusi |
| `button_icon_size` | **24dp** | Tugma ichidagi ikonka |
| `cell_height` | **48dp** | Ro‘yxat qatori balandligi |
| `chip_height` | **36dp** | Chip balandligi |
| `chip_item_icon_size` | **18dp** | Chip ikonkasi |
| `drawing_tools_icon_size` | **28dp** | **Chizish asbobi ikonkasi** |
| `content_margin` | **16dp** | Asosiy margin |
| `content_margin_half` | **8dp** | Yarim margin |
| `content_margin_quarter` | **4dp** | Chorak margin |
| `border_height` | **1dp** | Chegara qalinligi |
| `bikini_button_regular_icon_size` | **28dp** | Katta tugma ikonkasi |
| `alert_line_icon_size` | **28dp** | Alert line ikonkasi |

### 4.3. Shrift o‘lchamlari (sp)

| Resurs | Qiymat |
|---|---|
| `common_text_size` | **18sp** |
| `ast_medium_text_size` | **16sp** |
| `ast_large_text_size` | **18sp** |
| `button_text_size` | **14sp** |
| `common_button_text_size_big` | **16sp** |
| `common_button_text_size_medium` | **14sp** |
| `common_button_text_size_small` | **14sp** |
| `chart_link_dialog_title_text_size` | **16sp** |
| `chart_panel_time_picker_date_size` | **34sp** |
| `ds_line_height_body_large` | **24sp** |
| `ds_line_height_body_medium` | **20sp** |
| `ds_line_height_body_small` | **16sp** |

### 4.4. Letter-spacing tokenlari (`ds_letter_spacing_*` — `dimen` jadvalida FLOAT)

| Resurs | Qiymat (em) |
|---|---|
| `ds_letter_spacing_body2_r14` | 0.0178 |
| `ds_letter_spacing_body_r16_bold` | 0.0094 |
| `ds_letter_spacing_body_r16_medium` | 0.0094 |
| `ds_letter_spacing_body_r18` | 0.0278 |
| `ds_letter_spacing_button_r14` | 0.0071 |
| `ds_letter_spacing_caption_r10` | 0.0125 |
| `ds_letter_spacing_caption_r12_medium` | 0.0000 |
| `ds_letter_spacing_caption_r12_regular` | 0.0333 |
| `ds_letter_spacing_display` | 0.0000 |
| `ds_letter_spacing_h1_r34` | 0.0000 |
| `ds_letter_spacing_h4_r20_bold` | 0.0125 |
| `ds_letter_spacing_h4_r20_medium` | 0.0075 |
| `ds_letter_spacing_h4_r20_semibold` | 0.0075 |
| `ds_letter_spacing_headline` | 0.0000 |
| `ds_letter_spacing_label_small` | 0.0450 |
| `ds_letter_spacing_subtitle_r16` | 0.0107 |
| `ds_letter_spacing_title_small` | 0.0071 |

---

## 5. Shriftlar

Ilovada 7 ta TTF bor (`res/font/`). Family nomlari TTF `name` jadvalidan o‘qildi:

| Fayl | Family / Style | Bayt |
|---|---|---|
| `res/font/regular.ttf` | Roboto / Regular | 171676 |
| `res/font/bold.ttf` | Roboto / Bold | 170760 |
| `res/font/medium.ttf` | Roboto / Medium | 172064 |
| `res/font/roboto_flex.ttf` | Roboto Flex / Regular | 1654412 |
| `res/font/roboto_medium_numbers.ttf` | Roboto Medium / Regular | 3316 |
| `res/font/mono_regular.ttf` | Roboto Mono / Regular | 114624 |
| `res/font/noto_sans_medium.ttf` | Noto Sans / Medium | 452608 |

Asosiy matn shrifti — **Roboto** (`regular` / `medium` / `bold`); `roboto_flex.ttf` — variable shrift (1.6 MB). Demo chart uchun Roboto yetarli.

---

## 6. Ikonkalar

### 6.1. Muhim: manbada PNG emas, **vektor** ikonkalar

`res/drawable-*dpi/` papkalarida 410 PNG + 56 WebP bor, lekin ularning **barchasi kutubxona resurslari** (appcompat `abc_*`, exoplayer `exo_*`, Google sign-in, paywall bannerlar). TradingView’ning o‘z ikonkalari — `res/drawable/*.xml` ichidagi **binary AXML VectorDrawable** (1 372 ta XML).

Shu sababli ikonkalar AXML → SVG → PNG zanjiri bilan chiqarildi. Bu **haqiqiy vektor geometriya** (`pathData`), ya’ni istalgan o‘lchamda sifatli va rangni o‘zgartirish mumkin.

### 6.2. Natija

| Ko‘rsatkich | Qiymat |
|---|---|
| `apk-icons/` dagi PNG | **124** (112×112 px; 28dp × 4 = xxxhdpi) |
| `apk-icons/svg/` dagi SVG | **124** (viewBox 24×24 yoki 28×28) |
| Chizish asboblari (`*_drawings`) | **94** |
| UI ikonkalari (toolbar / menyu / chart type) | **30** |
| Kontakt-sheet | `apk-icons/sheet.png` (1428×2522) |
| Metadata | `apk-icons/manifest.json` |

**Rang:** asl fayllarda `fillColor` = `text_color_selector` (ColorStateList). Uning default holati theme attr `colorPaletteText` → **`dsColorPaletteText`**: light `#FF0F0F0F`, dark `#FFDBDBDB`. PNG’lar **dark** qiymat bilan (`#DBDBDB`) shaffof fonga chizilgan; light uchun `#0F0F0F` bilan almashtiring.

### 6.3. Chizish asboblari (94 ta) — fayl nomi ↔ TradingView nomi

Nomlar `resources.arsc` dagi `info_drawings_*` string resurslaridan (ilovaning o‘z UI matni).

| # | Fayl (`apk-icons/<nom>.png`) | TradingView nomi |
|---|---|---|
| 1 | `ic_abcd_drawings` | ABCD pattern  (info_drawings_abcd_pattern) |
| 2 | `ic_anchor_text_drawings` | Anchored text  (info_drawings_anchored_text) |
| 3 | `ic_anchored_avwap_drawings` | Anchored VWAP  (info_drawings_anchored_vwap) |
| 4 | `ic_arc_drawings` | Arc |
| 5 | `ic_arrow_down_drawings` | Arrow (pastga variant)  (info_drawings_arrow) |
| 6 | `ic_arrow_drawings` | Arrow |
| 7 | `ic_arrow_marker_down_drawings` | Arrow mark down |
| 8 | `ic_arrow_marker_drawings` | Arrow marker |
| 9 | `ic_arrow_marker_up_drawings` | Arrow mark up |
| 10 | `ic_bars_pattern_drawings` | Bar pattern  (info_drawings_bars_patter) |
| 11 | `ic_callout_drawings` | Callout |
| 12 | `ic_chart_context_menu_drawings` | Drawings — kontekst menyu ikonkasi  (matn resursi topilmadi) |
| 13 | `ic_comment_drawings` | Comment |
| 14 | `ic_cross_line_drawings` | Crossline |
| 15 | `ic_curve_drawings` | Curve |
| 16 | `ic_cyclic_lines_drawings` | Cyclic lines |
| 17 | `ic_cypher_drawings` | Cypher pattern  (info_drawings_cypher_pattern) |
| 18 | `ic_date_and_price_range_drawings` | Date and price range |
| 19 | `ic_date_range_drawing_drawings` | Date range  (info_drawings_date_range) |
| 20 | `ic_disjoint_angle_drawings` | —  (string resursi topilmadi; faqat disjoint_channel bor) |
| 21 | `ic_double_curve_drawings` | Double curve |
| 22 | `ic_drawing_drawings` | Keep drawing  (info_drawings_tool_drawing) |
| 23 | `ic_drawing_locked_drawings` | Lock — qulflangan chizma  (info_drawings_tool_lock) |
| 24 | `ic_eliott_correction_wave_drawings` | Elliott correction wave (A·B·C) |
| 25 | `ic_eliott_double_combo_wave_drawings` | Elliott double combo wave (W·X·Y)  (info_drawings_elliott_double_combowave) |
| 26 | `ic_eliott_impulse_wave_drawings` | Elliott impulse wave (1·2·3·4·5) |
| 27 | `ic_eliott_triangle_wave_drawings` | Elliott triangle wave (A·B·C·D·E) |
| 28 | `ic_eliott_triple_combo_wave_drawings` | Elliott triple combo wave (W·X·Y·X·Z) |
| 29 | `ic_elipse_drawings` | Ellipse |
| 30 | `ic_eraser_drawings` | Eraser  (info_drawings_tool_eraser) |
| 31 | `ic_extended_line_drawings` | Extended line |
| 32 | `ic_fib_channel_drawings` | Fib channel |
| 33 | `ic_fib_circles_drawings` | Fib circles |
| 34 | `ic_fib_retracement_drawings` | Fib retracement |
| 35 | `ic_fib_speed_resistance_arcs_drawings` | Fib speed resistance arcs |
| 36 | `ic_fib_speed_resistance_fan_drawings` | Fib speed resistance fan |
| 37 | `ic_fib_spiral_drawings` | Fib spiral |
| 38 | `ic_fib_time_zone_drawings` | Fib time zone |
| 39 | `ic_fib_wedge_drawings` | Fib wedge |
| 40 | `ic_fixed_range_volume_profile_drawings` | Fixed range volume profile |
| 41 | `ic_flag_mark_drawings` | Flag mark |
| 42 | `ic_flat_top_bottom_drawings` | Flat top/bottom |
| 43 | `ic_forecast_drawings` | Position forecast |
| 44 | `ic_gann_box_drawings` | Gann box |
| 45 | `ic_gann_fan_drawings` | Gann fan |
| 46 | `ic_gann_square_drawings` | Gann square |
| 47 | `ic_gann_square_fixed_drawings` | Gann fixed square |
| 48 | `ic_ghost_feed_drawings` | Ghost feed |
| 49 | `ic_head_and_shoulders_drawings` | Head and shoulders |
| 50 | `ic_highlighter_drawings` | Highlighter |
| 51 | `ic_horizontal_line_drawings` | Horizontal line |
| 52 | `ic_horizontal_ray_drawings` | Horizontal ray |
| 53 | `ic_info_line_drawings` | Info line |
| 54 | `ic_inside_pitchfork_drawings` | Inside pitchfork |
| 55 | `ic_long_position_drawings` | Long position |
| 56 | `ic_measure_drawings` | Measure  (info_drawings_tool_measure) |
| 57 | `ic_modified_schiff_pitchfork_drawings` | Modified Schiff pitchfork |
| 58 | `ic_note_drawings` | Note |
| 59 | `ic_parallel_channel_drawings` | Parallel channel |
| 60 | `ic_path_drawings` | Path |
| 61 | `ic_pin_drawings` | Pin |
| 62 | `ic_pitchfan_drawings` | Pitchfan |
| 63 | `ic_pitchfork_drawings` | Pitchfork |
| 64 | `ic_polyline_drawings` | Polyline |
| 65 | `ic_price_label_drawings` | Price label |
| 66 | `ic_price_note_drawings` | Price note |
| 67 | `ic_price_range_drawings` | Price range |
| 68 | `ic_projection_drawings` | Sector |
| 69 | `ic_ray_drawings` | Ray |
| 70 | `ic_rectangle_drawing_drawings` | Rectangle |
| 71 | `ic_regression_trend_drawings` | Regression trend |
| 72 | `ic_remove_drawings` | Remove  (info_drawings_tool_remove) |
| 73 | `ic_rotated_rectangle_drawings` | Rotated rectangle  (info_drawings_rotated_rectanglee) |
| 74 | `ic_schiff_pitchfork_drawings` | Schiff pitchfork |
| 75 | `ic_short_position_drawings` | Short position |
| 76 | `ic_signpost_drawings` | Signpost |
| 77 | `ic_sine_line_drawings` | Sine line |
| 78 | `ic_strong_magnet_drawings` | Strong magnet  (info_drawings_tool_strong_magnet) |
| 79 | `ic_table_drawings` | Table |
| 80 | `ic_text_drawings` | Text |
| 81 | `ic_three_drives_pattern_drawings` | Three drives pattern  (info_drawings_three_drives_patternn) |
| 82 | `ic_time_cycles_drawings` | Time cycles |
| 83 | `ic_trash_drawings` | Delete (savat)  (info_action_delete) |
| 84 | `ic_trend_angle_drawings` | Trend angle |
| 85 | `ic_trend_based_fib_extension_drawings` | Trend-based fib extension |
| 86 | `ic_trend_based_fib_time_drawings` | Trend-based fib time |
| 87 | `ic_trend_line_drawings` | Trendline |
| 88 | `ic_triangle_drawings` | Triangle |
| 89 | `ic_triangle_pattern_drawings` | Triangle pattern |
| 90 | `ic_tweet_drawings` | Post |
| 91 | `ic_unlocked_drawings` | —  (string resursi topilmadi) |
| 92 | `ic_vertical_line_drawings` | Vertical line |
| 93 | `ic_weak_magnet_drawings` | Weak magnet  (info_drawings_tool_weak_magnet) |
| 94 | `ic_xabcd_drawings` | XABCD pattern  (info_drawings_xabcd_pattern) |

### 6.4. UI ikonkalari (30 ta)

| # | Fayl | Vazifasi (resurs nomi bo‘yicha) |
|---|---|---|
| 1 | `ic_28_close` | Yopish (28dp) |
| 2 | `ic_28_search` | Qidiruv |
| 3 | `ic_add` | Qo‘shish (+) |
| 4 | `ic_alert_bell` | Alert (qo‘ng‘iroq) |
| 5 | `ic_chart_context_menu_apply_indicator` | Indikator qo‘llash |
| 6 | `ic_chart_context_menu_eye` | Ko‘rinish (eye) |
| 7 | `ic_chart_context_menu_lock` | Qulflash |
| 8 | `ic_chart_context_menu_text_note` | Matnli eslatma |
| 9 | `ic_chart_context_menu_trash` | O‘chirish (trash) |
| 10 | `ic_chart_context_menu_unlock` | Qulfdan chiqarish |
| 11 | `ic_chart_native_panel_more` | Ko‘proq (panel) |
| 12 | `ic_chart_native_panel_redo` | Redo |
| 13 | `ic_chart_native_panel_undo` | Undo |
| 14 | `ic_chart_type_area_28` | Chart turi: area |
| 15 | `ic_chart_type_bars_28` | Chart turi: bars |
| 16 | `ic_chart_type_baseline_28` | Chart turi: baseline |
| 17 | `ic_chart_type_candles_28` | Chart turi: candles |
| 18 | `ic_chart_type_hollow_candles_28` | Chart turi: hollow candles |
| 19 | `ic_favorite_star_28` | Sevimli (star) |
| 20 | `ic_fullscreen` | To‘liq ekran |
| 21 | `ic_indicator_alert` | Indikator alert |
| 22 | `ic_indicators_hidden` | Indikatorlar yashirilgan |
| 23 | `ic_indicators_shown` | Indikatorlar ko‘rsatilgan |
| 24 | `ic_more_dots_vertical` | Vertikal “…” menyu |
| 25 | `ic_note` | Eslatma (note) |
| 26 | `ic_remove` | Olib tashlash |
| 27 | `ic_settings_chart_screen` | Chart sozlamalari |
| 28 | `ic_share_chart_image` | Chart rasmini ulashish |
| 29 | `ic_zoom_in` | Zoom in |
| 30 | `ic_zoom_out` | Zoom out |

---

## 7. CHEKLOVLAR — halol ro‘yxat

Quyidagilar **dekod qilinmadi** yoki **taxmin**. Ularni fakt sifatida ishlatmang:

1. **Chart’ning o‘z palitrasi (candle/grid/crosshair) APK ichida topilmadi.** Chart WebView ichida yuklanadi (`assets/feature_chart_kotlin_js_client.js`, 371 KB) va bu faylda **bitta ham hex rang yo‘q** (`#RRGGBB` = 0 ta, `rgb(` = 0 ta) — u faqat native↔JS ko‘prik. Ya’ni chart kutubxonasining o‘zi tashqi (tarmoq) resurs. Shu sababli TradingView’ning klassik chart ranglari (`#131722`, `#363c4e`, `#26a69a`, `#ef5350`) **tasdiqlanmagan** — bu hujjatda ular yo‘q. Berilgan ranglar — ilovaning **UI / design-system** ranglari.
2. **8 ta `classes.dex` (~80 MB) dekod qilinmadi.** Kotlin/Java kodidagi hardcode qilingan ranglar va chart tool default sozlamalari olinmadi. Faqat resurslar tahlil qilindi.
3. **Android framework attr nomlari (0x0101xxxx) noma’lum.** Theme itemlarda faqat `0x7F0xxxxx` (ilova attr’lari) nomlandi; framework attr’lari ID bilan qoldi. Shuning uchun `android:colorBackground` kabi qiymatlar semantik nom bilan berilmaydi.
4. **1 261 rangdan 495 tasi `#AARRGGBB` ga yechilmadi** — ular ColorStateList yoki boshqa resursga reference. Jadvalda faqat yechilganlari bor.
5. **`res/drawable-*dpi` dagi 410 PNG / 56 WebP — TradingView ikonkasi emas.** Hammasi uchinchi tomon kutubxonalari. Shuning uchun "PNG ikonkalarni ko‘chirish" vazifasi vektor ikonkalarni render qilish bilan almashtirildi.
6. **2 ikonka chiqmadi:** `ic_pin` (vektor fayli topilmadi — `res/drawable` da yo‘q) va `ic_close` (faqat to‘liq shaffof `fillColor`, ko‘rinadigan piksel yo‘q). `ic_close` o‘rniga `ic_28_close` ishlatish mumkin.
7. **`ds_letter_spacing_*` ning 8 tasi** FLOAT emas, DIMENSION sifatida saqlangan va androguard ularni noto‘g‘ri o‘qidi (masalan `1258291sp`). Jadvalda faqat to‘g‘ri FLOAT bo‘lganlari berildi; qolganlari ishlatilmadi.
8. **8 ta `dimen` butunlay noto‘g‘ri o‘qildi** (raw qiymat `0xFFFFFD01` kabi) — androguard’ning Res_value chetlanishi. Masalan `abc_action_bar_subtitle_top_margin_material`. Ular jadvallarga kiritilmagan.
9. **1 454 style’dan faqat 2 tasi** (`DsAppTheme`, `DsAppTheme.Dark`) to‘liq ochildi. Qolganlari matn appearance / widget style’lar — ular parent chain orqali meros oladi va alohida tekshirilmagan.
10. **Ikonka "selected" rangi aniqlanmadi:** `text_color_selector` ning `state_selected=true` holati `@android:0106000B` ga havola qiladi — bu Android ichki rangi, nomi noma’lum.
11. **`config.arm64_v8a.apk` (58 KB)** ham chiqarildi, lekin u faqat native lib fragmenti — dizayn ma’lumoti yo‘q.
12. **dp qiymatlar density’ga bog‘liq:** berilgan dp — `mdpi` bazasi; haqiqiy piksel = dp × (density / 160).

---

## 8. Demo chart uchun amaliy tavsiya (interpretatsiya — fakt emas)

Quyidagi jadval — **o‘lchangan** tokenlarni demo chart komponentlariga bog‘lash. Bu talqin; ilovada aynan shunday ishlatilishi tekshirilmagan.

| Demo element | Tavsiya | Manba token |
|---|---|---|
| Chart foni | #0F0F0F (yoki #000000) | `dsBackgroundColorSecondaryNeutralExtraLight` |
| Toolbar / panel foni | #1F1F1F | `dsBackgroundColorPrimaryNeutralExtraLight` |
| Grid | #1F1F1F / #4A4A4A | `dsFillColorPrimaryNeutralThin / dsFillColorPrimaryNeutralNormal` |
| Asosiy matn | #DBDBDB | `dsContentColorPrimaryNeutralBold` |
| Axis label | #8C8C8C | `dsContentColorPrimaryNeutral` |
| Up / bullish | #22AB94 | `dsContentColorPrimaryPositive` |
| Down / bearish | #F7525F | `dsContentColorPrimaryNegative` |
| Aksent / tanlangan tool | #2962FF | `dsContentColorPrimaryAccent` |
| Toolbar balandligi | 52dp | `chart_panel_height` |
| Tool ikonkasi | 28dp | `drawing_tools_icon_size` |
| Ikonka rangi | #DBDBDB (dark) / #0F0F0F (light) | `dsColorPaletteText` |
| Matn shrifti | Roboto 400/500/700, 14sp | `res/font/*.ttf + button_text_size` |

---

## 9. Fayllar

| Yo‘l | Tavsif |
|---|---|
| `assets/apk-icons/*.png` | 124 ikonka, 112 px, nom = resurs nomi |
| `assets/apk-icons/svg/*.svg` | 124 ikonka vektor (rangni erkin o‘zgartirish mumkin) |
| `assets/apk-icons/sheet.png` | Kontakt-sheet, har ikonka ostida nomi |
| `assets/apk-icons/manifest.json` | Har ikonka: tur, dominant rang, SVG yo‘li |
| `work/apk/base.apk` | XAPK’dan chiqarilgan asosiy APK (114 MB) |
| `work/extracted/` | resources.arsc, AndroidManifest.xml, res/drawable*/**.xml, res/font/*.ttf, assets/* |
| `work/decoded.json` | To‘liq dekod: colors / dimens / strings / styles |
| `work/themes.json` | DsAppTheme + DsAppTheme.Dark token xaritasi |
| `work/tv_colors.txt` | TradingView’ga tegishli 462 rang (nom + hex) |
| `work/dimens.txt` | 1 494 dimen (nom + qiymat) |
| `work/venv/` | androguard + Pillow + skia-python muhiti |

### Qayta hosil qilish

```powershell
# 1) XAPK -> APK
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z=[System.IO.Compression.ZipFile]::OpenRead("...\tradingview-1-20-87-0-1002595.xapk")
[System.IO.Compression.ZipFileExtensions]::ExtractToFile($z.GetEntry("com.tradingview.tradingviewapp.apk"), "...\work\apk\base.apk", $true)
# 2) resources.arsc + resurslar dekod (androguard)
work\venv\Scripts\python.exe work\decode_all.py
# 3) Ikonkalar: AXML -> SVG -> PNG -> sheet.png
work\venv\Scripts\python.exe work\make_svg2.py
work\venv\Scripts\python.exe work\build_assets.py
```

