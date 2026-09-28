# CSS inventar (DIET F4.1b)

> Avtomatik: `node scripts/css-inventory.mjs`. **Faqat hisobot** — hech narsa o'chirilmagan.
> Token-darajasida (class/id matnda uchraydimi); property-darajasidagi solishtirish emas. `hard` = o'lik nomzod, `maybe` = JS'da dinamik yig'ilishi mumkin. O'chirishdan oldin brauzerda (qoida 8) va DevTools Coverage bilan tasdiqlang.

| Fayl | Qator | Qoida | hard | maybe | hard qator | `!important` (hard ichida) |
|---|---|---|---|---|---|---|
| 00-components.core.css | 173 | 19 | 0 | 0 | 0 | 0 (0) |
| admin-plain.css | 170 | 54 | 12 | 1 | 36 | 0 (0) |
| admin.css | 1139 | 189 | 92 | 0 | 602 | 0 (0) |
| borderless.css | 719 | 87 | 18 | 1 | 134 | 0 (0) |
| card-sheets.css | 30 | 3 | 0 | 0 | 0 | 0 (0) |
| chat-dark-redesign.css | 229 | 79 | 12 | 0 | 30 | 0 (0) |
| chat.css | 2182 | 332 | 51 | 0 | 374 | 72 (9) |
| dark-theme-fix.css | 650 | 98 | 18 | 1 | 132 | 0 (0) |
| devs-utility.css | 2450 | 612 | 438 | 159 | 2191 | 0 (0) |
| feed.css | 1417 | 183 | 57 | 4 | 483 | 16 (7) |
| groups.css | 569 | 131 | 34 | 3 | 135 | 5 (0) |
| loading.css | 431 | 53 | 7 | 3 | 56 | 2 (1) |
| local-utility.css | 214 | 124 | 90 | 7 | 204 | 8 (0) |
| mono.css | 159 | 62 | 20 | 4 | 60 | 58 (20) |
| nav.css | 1348 | 219 | 34 | 0 | 212 | 21 (7) |
| no-animations.css | 14 | 2 | 0 | 0 | 0 | 8 (0) |
| post-composer.css | 170 | 22 | 0 | 0 | 0 | 2 (0) |
| profile.css | 1113 | 151 | 10 | 3 | 99 | 5 (0) |
| sidebar-x.css | 330 | 95 | 3 | 0 | 6 | 14 (1) |
| splash.css | 56 | 6 | 0 | 0 | 0 | 0 (0) |
| theme.css | 254 | 28 | 9 | 0 | 47 | 0 (0) |
| ui-improvements.css | 1729 | 217 | 76 | 20 | 675 | 8 (0) |
| x-design.css | 1214 | 323 | 20 | 4 | 62 | 116 (20) |
| **JAMI** | **16760** | **3089** | **1001** | **210** | **5538** | **335 (65)** |

## hard-o'lik selektorlar (har fayldan 30 tagacha)

### admin-plain.css (12)
- `#actionsView .dash-bar`
- `#actionsView .dash-item b`
- `#actionsView .dash-item--warn b`
- `#actionsView .dash-item--ok b`
- `#actionsView .dash-item--info b`
- `#actionsView .ua-locked-banner`
- `#actionsView .ua-locked-banner::before`
- `#actionsView .audit-item`
- `#actionsView .audit-item:hover`
- `#actionsView .audit-title`
- `#actionsView .audit-empty`
- `#actionsView .audit-empty::before`

### admin.css (92)
- `.users-admin-sub`
- `.ua-avi`
- `.ua-avi-img`
- `.ua-avi-placeholder`
- `.ua-date--blocked`
- `.ua-locked-banner`
- `.ua-unlock-banner-btn`
- `.ua-unlock-banner-btn:hover`
- `.ua-row--locked`
- `.ua-row--locked:hover`
- `.ua-avi-img--blurred`
- `.ua-pwd-input`
- `.ua-pwd-input:focus`
- `.ua-pwd-input::placeholder`
- `.ua-history-btn`
- `.ua-history-btn:hover`
- `.ua-detail-modal`
- `#uaDetailModal.ua-modal-overlay`
- `#uaDetailModal .ua-detail-modal`
- `#uaDetailModal .ua-detail-modal`
- `#uaDetailModal .ua-detail-modal`
- `#uaDetailModal.ua-modal-overlay`
- `#uaDetailModal .ua-detail-modal`
- `#uaDetailModal .ua-detail-modal`
- `#uaDetailModal .ua-detail-modal`
- `#uaDetailModal .ua-modal-title`
- `#uaDetailModal .ua-modal-title`
- `.ua-detail-head`
- `.ua-detail-avi`
- `.ua-detail-avi img`
- … yana 62 ta

### borderless.css (18)
- `.modal-content, [data-theme="dark"] .modal-content`
- `.up-stat-box, [data-theme="dark"] .up-stat-box`
- `.chat-input-bar, [data-theme="dark"] .chat-input-bar`
- `.chat-input-wrap, [data-theme="dark"] .chat-input-wrap, [data-theme="dark"] .chat-input-wr`
- `[data-theme="dark"] .msg-in .msg-bubble`
- `[data-theme="dark"] .msg-out .msg-bubble`
- `.badge-pub, .badge-priv, [data-theme="dark"] .badge-pub, [data-theme="dark"] .badge-priv`
- `.sb-wrap, [data-theme="dark"] .sb-wrap`
- `.visibility-row, [data-theme="dark"] .visibility-row, [data-theme="dark"] .visibility-row.`
- `.onb-card, .admin-card, .verify-card, [data-theme="dark"] .onb-card, [data-theme="dark"] .`
- `[data-theme="dark"] .admin-card:hover`
- `.reel-avi, [data-theme="dark"] .reel-avi`
- `#offlineIndicator`
- `.cached-badge`
- `.card-hover:hover`
- `#offlineIndicator::before`
- `.group-card, .group-hdr`
- `[data-theme="dark"] .admin-card`

### chat-dark-redesign.css (12)
- `#chatThreadModal .msg-edited`
- `#chatThreadModal .chat-reply-preview`
- `#chatThreadModal .chat-msg.theirs .chat-reply-preview`
- `#chatThreadModal .chat-reply-preview:hover`
- `#chatThreadModal .crp-name`
- `#chatThreadModal .crp-text`
- `#chatThreadModal .reaction-pill`
- `#chatThreadModal .reaction-pill:hover`
- `#chatThreadModal .reaction-pill.mine`
- `#chatThreadModal .typing-bubble`
- `#chatThreadModal .typing-name`
- `#chatThreadModal .typing-dots span`

### chat.css (51)
- `.chat-thread-send`
- `.chat-thread-send:hover`
- `.chat-img-msg`
- `.chat-img-msg img`
- `.chat-img-msg img:hover`
- `.chat-video-msg`
- `.chat-video-msg video`
- `.chat-reply-preview`
- `.chat-msg.theirs .chat-reply-preview`
- `.chat-reply-preview:hover`
- `.chat-msg.theirs .chat-reply-preview:hover`
- `.crp-name`
- `.chat-msg.theirs .crp-name`
- `.crp-text`
- `.chat-msg.theirs .crp-text`
- `.chat-reactions`
- `.chat-msg.mine .chat-reactions`
- `.reaction-pill`
- `.reaction-pill:hover`
- `.reaction-pill.mine`
- `.emoji-picker`
- `.emoji-picker.show`
- `.emoji-pick-btn`
- `.emoji-pick-btn:hover`
- `.msg-edited`
- `.chat-msg.theirs .msg-edited`
- `.typing-bubble`
- `.typing-name`
- `.typing-label`
- `.typing-dots`
- … yana 21 ta

### dark-theme-fix.css (18)
- `[data-theme="dark"] .modal-content`
- `[data-theme="dark"] .msg-out .msg-bubble`
- `[data-theme="dark"] .msg-in .msg-bubble`
- `[data-theme="dark"] .chat-input-bar`
- `[data-theme="dark"] .chat-input-wrap`
- `[data-theme="dark"] .chat-input-wrap:focus-within`
- `[data-theme="dark"] .badge-pub`
- `[data-theme="dark"] .badge-priv`
- `[data-theme="dark"] .onb-card, [data-theme="dark"] .admin-card, [data-theme="dark"] .verif`
- `[data-theme="dark"] .admin-card:hover`
- `[data-theme="dark"] .sb-item`
- `[data-theme="dark"] .sb-item:hover`
- `[data-theme="dark"] .sb-item.active`
- `[data-theme="dark"] .reel-avi`
- `[data-theme="dark"] .visibility-row`
- `[data-theme="dark"] .visibility-row.is-public`
- `[data-theme="dark"] .feed-empty-title`
- `[data-theme="dark"] .feed-empty-text`

### devs-utility.css (438)
- `.ff-arial`
- `.fs-5px`
- `.fs-10px`
- `.fs-15px`
- `.fs-20px`
- `.fs-25px`
- `.fs-30px`
- `.fs-35px`
- `.fs-40px`
- `.fs-45px`
- `.fs-50px`
- `.fs-55px`
- `.fs-60px`
- `.fs-65px`
- `.fs-70px`
- `.fs-75px`
- `.fs-80px`
- `.fs-85px`
- `.fs-90px`
- `.fs-95px`
- `.fs-100px`
- `.fsn`
- `.fso`
- `.fw-100`
- `.fw-200`
- `.fw-300`
- `.fw-400`
- `.fw-700`
- `.fw-800`
- `.fw-900`
- … yana 408 ta

### feed.css (57)
- `.hdr-search-expand`
- `#reelsView.on`
- `.badge-pub`
- `.badge-priv`
- `.reel-act span`
- `.reel-act.liked svg`
- `.reel-pause-icon`
- `.reel-pause-icon.show`
- `[data-theme="dark"] .reel-avi:hover`
- `[data-theme="dark"] .reel-follow`
- `[data-theme="dark"] .reel-follow:hover`
- `[data-theme="dark"] .reel-follow.following`
- `[data-theme="dark"] .reel-progress-track`
- `[data-theme="dark"] .reel-progress-fill`
- `[data-theme="dark"] .reel-pause-icon`
- `.reel-progress`
- `.reel-progress-track`
- `.reel-progress-fill`
- `.reel-top-bar`
- `.reel-top-btn`
- `.reel-top-btn:hover`
- `.reel-top-btn svg`
- `.reel-top-username`
- `.reel-side-avi`
- `.reel-side-avi img`
- `.rcap-avi`
- `.rcap-avi img`
- `.rcap-name`
- `.rcap-follow`
- `.rcap-follow.following`
- … yana 27 ta

### groups.css (34)
- `.chat-row-type`
- `.chat-row-type svg`
- `.chat-row-grp-badge--channel`
- `.grp-choice-btn`
- `.grp-choice-btn:hover`
- `.grp-choice-btn + .grp-choice-btn`
- `.grp-choice-icon`
- `.grp-choice-icon--group`
- `.grp-choice-icon--channel`
- `.grp-choice-icon--user`
- `.grp-choice-info`
- `.grp-choice-name`
- `.grp-choice-sub`
- `.grp-choice-arrow`
- `.grp-info-header`
- `.grp-info-avi`
- `.grp-info-avi img`
- `.grp-info-name`
- `.grp-info-type`
- `.grp-info-desc`
- `.grp-section-title`
- `.grp-info-actions`
- `.grp-info-actions .btn-ghost`
- `.grp-info-actions .btn-danger`
- `.grp-privacy-toggle`
- `.grp-privacy-opt`
- `.grp-privacy-opt.active`
- `.grp-invite-box`
- `.grp-invite-code`
- `.grp-invite-btn`
- … yana 4 ta

### loading.css (7)
- `.auth-btn-loading`
- `.auth-btn-loading::after`
- `.password-strength`
- `.strength-bar`
- `.strength-bar.weak`
- `.strength-bar.medium`
- `.strength-bar.strong`

### local-utility.css (90)
- `.pos-sticky`
- `.pos-fixed`
- `.pos-absolute`
- `.pos-relative`
- `.z-0`
- `.z-10`
- `.z-100`
- `.z-1000`
- `.z-9999`
- `.gap-4px`
- `.gap-5px`
- `.gap-8px`
- `.gap-12px`
- `.gap-14px`
- `.gap-15px`
- `.gap-16px`
- `.gap-20px`
- `.gap-24px`
- `.gap-25px`
- `.gap-28px`
- `.gap-30px`
- `.gap-32px`
- `.gap-35px`
- `.gap-40px`
- `.aspect-4-3`
- `.aspect-16-9`
- `.aspect-9-16`
- `.aspect-3-4`
- `.aspect-2-1`
- `.aspect-3-2`
- … yana 60 ta

### mono.css (20)
- `.ua-avi-placeholder, .ua-avi-placeholder *`
- `.ua-unlock-banner-btn, .ua-unlock-banner-btn *`
- `.ua-detail-tab.active, .ua-detail-tab.active *`
- `.chat-thread-send, .chat-thread-send *`
- `.chat-thread-send:hover, .chat-thread-send:hover *`
- `.typing-dots span, .typing-dots span *`
- `.typing-dot, .typing-dot *`
- `#chatScrollDownBtn, #chatScrollDownBtn *`
- `[data-theme="dark"] .msg-out .msg-bubble, [data-theme="dark"] .msg-out .msg-bubble *`
- `[data-theme="dark"] .reel-progress-fill, [data-theme="dark"] .reel-progress-fill *`
- `.reel-progress-fill, .reel-progress-fill *`
- `.rcap-follow, .rcap-follow *`
- `.feed-empty-cta, .feed-empty-cta *`
- `.chat-row-grp-badge--channel, .chat-row-grp-badge--channel *`
- `.grp-privacy-opt.active, .grp-privacy-opt.active *`
- `.toggle input:checked + .toggle-track, .toggle input:checked + .toggle-track *`
- `.avatar-crop-save, .avatar-crop-save *`
- `.upload-file-icon.image, .upload-file-icon.image *`
- `.scroll-progress-bar, .scroll-progress-bar *`
- `.scroll-progress, .scroll-progress *`

### nav.css (34)
- `.nav-btn.nav-hidden`
- `.upload-drop-icon`
- `.upload-drop-text`
- `.upload-drop-opt`
- `.upload-drop-sub`
- `.visibility-row`
- `.visibility-row.is-public`
- `.visibility-label`
- `.vis-icon`
- `.visibility-desc`
- `.toggle-track`
- `.toggle input:checked + .toggle-track`
- `.toggle-track::after`
- `.toggle input:checked + .toggle-track::after`
- `.detail-back`
- `.app-hdr.search-open`
- `.hdr-search-close`
- `.sb-logo-tip`
- `.sb-logo-row:hover .sb-logo-tip`
- `.sb-search-row`
- `.sb-mute-btn`
- `.sb-mute-btn span`
- `.sb-mute-btn:hover`
- `.sb-mute-btn:active`
- `.sb-mute-btn.is-unmuted`
- `#reelsView`
- `.reels-mute-btn`
- `#followingView .feed`
- `.hdr-search-expand`
- `.nav-btn.nav-hidden`
- … yana 4 ta

### profile.css (10)
- `.settings-icon-btn`
- `.settings-icon-btn:hover`
- `.grid-like`
- `.up-grid-label`
- `.up-posts-tab-item`
- `.grid-cell-is-video`
- `.grid-cell-is-video::after`
- `.grid-cell-is-video:hover::after`
- `.grid-cell-is-video::before`
- `.grid-cell-is-video:hover::before`

### sidebar-x.css (3)
- `nav.bot-nav .nav-btn.nav-hidden`
- `#reelsView`
- `nav.bot-nav .sb-logo-tip`

### theme.css (9)
- `.theme-transition-overlay`
- `.theme-transition-overlay.active`
- `.theme-btn .icon-sun`
- `.theme-btn .icon-moon`
- `[data-theme="dark"] .theme-btn:hover .icon-sun`
- `.glass-heavy`
- `.success-glow`
- `.card-hover`
- `.card-hover:hover`

### ui-improvements.css (76)
- `.theme-toast`
- `.theme-toast.show`
- `.theme-toast-icon`
- `.skeleton-post-video .skel-media`
- `.skeleton-post-video .skel-media::after`
- `.skeleton-post-image .skel-media`
- `.search-recent-section`
- `.search-recent-header`
- `.search-clear-all`
- `.search-clear-all:hover`
- `.search-trending-section`
- `.search-trending-header`
- `.search-trending-carousel`
- `.search-trending-carousel::-webkit-scrollbar`
- `.search-trending-tag`
- `.search-trending-tag:hover`
- `.search-history-item`
- `.search-history-item:hover`
- `.search-history-icon`
- `.search-history-text`
- `.search-history-remove`
- `.search-history-item:hover .search-history-remove`
- `.search-history-remove:hover`
- `.reel-progress-track`
- `.reel-progress-fill`
- `.reel:hover .reel-side`
- `.reel-act:hover svg`
- `.vc-speed`
- `.vc-speed:hover`
- `.vc-pip`
- … yana 46 ta

### x-design.css (20)
- `.ua-avi-placeholder, .ua-avi-placeholder *`
- `.ua-unlock-banner-btn, .ua-unlock-banner-btn *`
- `.ua-detail-tab.active, .ua-detail-tab.active *`
- `.chat-thread-send, .chat-thread-send *`
- `.chat-thread-send:hover, .chat-thread-send:hover *`
- `.typing-dots span, .typing-dots span *`
- `.typing-dot, .typing-dot *`
- `#chatScrollDownBtn, #chatScrollDownBtn *`
- `[data-theme="dark"] .msg-out .msg-bubble, [data-theme="dark"] .msg-out .msg-bubble *`
- `[data-theme="dark"] .reel-progress-fill, [data-theme="dark"] .reel-progress-fill *`
- `.reel-progress-fill, .reel-progress-fill *`
- `.rcap-follow, .rcap-follow *`
- `.feed-empty-cta, .feed-empty-cta *`
- `.chat-row-grp-badge--channel, .chat-row-grp-badge--channel *`
- `.grp-privacy-opt.active, .grp-privacy-opt.active *`
- `.toggle input:checked + .toggle-track, .toggle input:checked + .toggle-track *`
- `.avatar-crop-save, .avatar-crop-save *`
- `.upload-file-icon.image, .upload-file-icon.image *`
- `.scroll-progress-bar, .scroll-progress-bar *`
- `.scroll-progress, .scroll-progress *`
