const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const STATUSES = ['Pending approval', 'Confirmed', 'Preparing', 'Ready', 'Assigned', 'Picked Up', 'Out for delivery', 'Delivery problem', 'Delivered', 'Collected', 'Served', 'Completed', 'Cancelled'];
const SESSION_COOKIE = 'dar_admin_session';
const STAFF_COOKIE = 'dar_staff_session';
const CUSTOMER_COOKIE = 'dar_customer_session';
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;
const DEFAULT_DESIGN = {
  restaurantName: 'New Burger',
  logoText: 'NB',
  logoImage: '',
  backgroundColor: '#fffaf4',
  backgroundImage: '',
  heroImage: '',
  aboutImage: '',
  themePreset: 'new-burger-bright',
  secondaryBackground: '#ffffff',
  accentColor: '#c62832',
  goldColor: '#f3c744',
  textColor: '#202124',
  mutedColor: '#626873',
  cardColor: '#ffffff',
  borderColor: '#e8e3dc',
  cornerRadius: 14,
  heroOverlay: 48,
  backgroundStyle: 'plain',
  showFeatured: true,
  showOffers: true,
  showBenefits: true,
  localizedContent: {
    en: { heroTitle: 'Good food. Good mood.', heroSubtitle: 'Freshly prepared favourites, made for sharing.', heroButton: 'Order now', aboutStory: '' },
    ckb: { heroTitle: 'خواردنی باش، هەستی باش.', heroSubtitle: 'خواردنە دڵخوازەکانت بە تازەیی بۆ هاوبەشکردن ئامادە دەکەین.', heroButton: 'داوا بکە', aboutStory: '' },
    ar: { heroTitle: 'طعام طيب، ومزاج جيد.', heroSubtitle: 'نحضّر أطباقك المفضّلة طازجة لتستمتع بها.', heroButton: 'اطلب الآن', aboutStory: '' }
  },
  aboutStory: '',
  contactPhone: '',
  contactEmail: '',
  contactAddress: '',
  rewardsPointsPer1000: 0,
  rewardsThreshold: 0,
  rewardsDescription: ''
};
const LEGACY_DEFAULT_PALETTE = {
  backgroundColor: '#141312',
  secondaryBackground: '#1c1a18',
  accentColor: '#f28a24',
  goldColor: '#d6aa5b',
  textColor: '#f7f3ec',
  mutedColor: '#b9b1a7',
  cardColor: '#211f1c',
  borderColor: '#39342e'
};

function writeStore(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, file);
}

function readStore(file) {
  let store;
  const isNewStore = !fs.existsSync(file);
  if (isNewStore) {
    store = {
      menu: [],
      orders: [],
      customers: [],
      staff: [],
      design: { ...DEFAULT_DESIGN }
    };
  } else {
    store = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  if (!store || !Array.isArray(store.menu) || !Array.isArray(store.orders)) {
    throw new Error(`Invalid restaurant data file: ${file}`);
  }
  const original = JSON.stringify(store);
  store.design = { ...DEFAULT_DESIGN, ...store.design };
  const storedPalette = store.design;
  if (storedPalette.themePreset === 'premium-dark' &&
      Object.entries(LEGACY_DEFAULT_PALETTE).every(([key, value]) => storedPalette[key] === value)) {
    Object.assign(store.design, {
      themePreset: DEFAULT_DESIGN.themePreset,
      ...Object.fromEntries(Object.keys(LEGACY_DEFAULT_PALETTE).map(key => [key, DEFAULT_DESIGN[key]])),
      backgroundStyle: DEFAULT_DESIGN.backgroundStyle,
      heroOverlay: DEFAULT_DESIGN.heroOverlay
    });
    if (store.design.localizedContent?.en?.heroSubtitle === 'Made fresh, packed with care, and delivered to your door in Erbil.') {
      store.design.localizedContent.en.heroSubtitle = DEFAULT_DESIGN.localizedContent.en.heroSubtitle;
    }
    for (const language of ['ckb', 'ar']) {
      const copy = store.design.localizedContent?.[language];
      if (!copy) continue;
      for (const field of ['heroTitle', 'heroSubtitle', 'heroButton']) {
        if (!copy[field]) copy[field] = DEFAULT_DESIGN.localizedContent[language][field];
      }
    }
  }
  store.designDraft = store.designDraft && typeof store.designDraft === 'object' ? store.designDraft : null;
  store.previousDesign = store.previousDesign && typeof store.previousDesign === 'object' ? store.previousDesign : null;
  store.settings = { deliveryFee: 0, minimumOrder: 0, pickupEnabled: true, dineInEnabled: false, ...store.settings };
  store.coupons = Array.isArray(store.coupons) ? store.coupons : [];
  store.auditLogs = Array.isArray(store.auditLogs) ? store.auditLogs : [];
  store.promotions = Array.isArray(store.promotions) ? store.promotions : [];
  store.reviews = Array.isArray(store.reviews) ? store.reviews : [];
  store.customers = Array.isArray(store.customers) ? store.customers : [];
  store.customers.forEach(customer => {
    customer.addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
    customer.favorites = Array.isArray(customer.favorites) ? customer.favorites : [];
  });
  store.staff = Array.isArray(store.staff) ? store.staff : [];
  store.orderKeys = Array.isArray(store.orderKeys) ? store.orderKeys : [];
  store.tables = Array.isArray(store.tables) ? store.tables : [];
  store.settings.deliveryFee = Number.isSafeInteger(store.settings.deliveryFee) ? store.settings.deliveryFee : 0;
  store.settings.minimumOrder = Number.isSafeInteger(store.settings.minimumOrder) ? store.settings.minimumOrder : 0;
  store.settings.pickupEnabled = store.settings.pickupEnabled !== false;
  store.settings.dineInEnabled = store.settings.dineInEnabled === true;
  store.settings.deliveryArea = store.settings.deliveryArea || null;
  if (isNewStore || JSON.stringify(store) !== original) writeStore(file, store);
  return store;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function equalHash(left, right) {
  return Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function text(value, field, maximum = 250) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw Object.assign(new Error(`${field} is required and must be at most ${maximum} characters.`), { status: 400 });
  }
  return value.trim();
}

function optionalText(value, field, maximum = 500) {
  if (value == null || value === '') return '';
  return text(value, field, maximum);
}

function validateImage(value) {
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//')) {
    const url = new URL(value, 'http://localhost');
    return `${url.pathname}${url.search}${url.hash}`;
  }
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol)) return url.href;
  } catch {}
  throw Object.assign(new Error('Image must be an http(s) URL or a site-relative path.'), { status: 400 });
}

function validateMenuItem(input) {
  const name = text(input.name, 'Name', 100);
  const category = text(input.category, 'Category', 60);
  const desc = text(input.desc, 'Description', 500);
  const price = Number(input.price);
  if (!Number.isSafeInteger(price) || price < 1 || price > 100000000) {
    throw Object.assign(new Error('Price must be a positive whole number in IQD.'), { status: 400 });
  }
  const image = validateImage(optionalText(input.image, 'Image URL', 500));
  if (input.ingredients != null && (!Array.isArray(input.ingredients) || input.ingredients.length > 20)) {
    throw Object.assign(new Error('Ingredients must be a list of up to 20 items.'), { status: 400 });
  }
  if (input.extras != null && (!Array.isArray(input.extras) || input.extras.length > 20)) {
    throw Object.assign(new Error('Extras must be a list of up to 20 items.'), { status: 400 });
  }
  if (input.available != null && typeof input.available !== 'boolean') {
    throw Object.assign(new Error('Product availability must be true or false.'), { status: 400 });
  }
  const ingredients = Array.isArray(input.ingredients)
    ? input.ingredients.map(value => text(value, 'Ingredient', 60))
    : [];
  const extras = Array.isArray(input.extras) ? input.extras.map(extra => {
    const name = text(extra?.name, 'Extra name', 60);
    const extraPrice = Number(extra?.price);
    if (!Number.isSafeInteger(extraPrice) || extraPrice < 0 || extraPrice > 100000000) {
      throw Object.assign(new Error('Extra prices must be non-negative whole numbers in IQD.'), { status: 400 });
    }
    return { name, price: extraPrice };
  }) : [];
  return {
    name,
    category,
    price,
    desc,
    image,
    emoji: optionalText(input.emoji, 'Emoji', 12) || '🍽️',
    art: optionalText(input.art, 'Artwork style', 30),
    tag: optionalText(input.tag, 'Tag', 30),
    ingredients,
    extras,
    available: input.available !== false,
    prepTime: input.prepTime == null || input.prepTime === '' ? null : (() => {
      const value = Number(input.prepTime);
      if (!Number.isSafeInteger(value) || value < 1 || value > 240) {
        throw Object.assign(new Error('Preparation time must be between 1 and 240 minutes.'), { status: 400 });
      }
      return value;
    })()
  };
}

function validateDesign(input) {
  const restaurantName = text(input.restaurantName, 'Restaurant name', 60);
  const logoText = optionalText(input.logoText, 'Logo text', 4) || restaurantName.slice(0, 1).toUpperCase();
  const logoImage = validateImage(optionalText(input.logoImage, 'Logo image', 500));
  const backgroundImage = validateImage(optionalText(input.backgroundImage, 'Background image', 500));
  const heroImage = validateImage(optionalText(input.heroImage, 'Hero image', 500));
  const aboutImage = validateImage(optionalText(input.aboutImage, 'About Us image', 500));
  const color = (value, label, fallback) => {
    const result = optionalText(value, label, 7) || fallback;
    if (!/^#[0-9a-f]{6}$/i.test(result)) {
      throw Object.assign(new Error(`${label} must be a six-digit hex color.`), { status: 400 });
    }
    return result;
  };
  const backgroundColor = color(input.backgroundColor, 'Background color', DEFAULT_DESIGN.backgroundColor);
  const secondaryBackground = color(input.secondaryBackground, 'Secondary background', DEFAULT_DESIGN.secondaryBackground);
  const accentColor = color(input.accentColor, 'Accent color', DEFAULT_DESIGN.accentColor);
  const goldColor = color(input.goldColor, 'Gold highlight color', DEFAULT_DESIGN.goldColor);
  const textColor = color(input.textColor, 'Text color', DEFAULT_DESIGN.textColor);
  const mutedColor = color(input.mutedColor, 'Muted text color', DEFAULT_DESIGN.mutedColor);
  const cardColor = color(input.cardColor, 'Card color', DEFAULT_DESIGN.cardColor);
  const borderColor = color(input.borderColor, 'Border color', DEFAULT_DESIGN.borderColor);
  const cornerRadius = Number(input.cornerRadius ?? DEFAULT_DESIGN.cornerRadius);
  const heroOverlay = Number(input.heroOverlay ?? DEFAULT_DESIGN.heroOverlay);
  if (!Number.isSafeInteger(cornerRadius) || cornerRadius < 6 || cornerRadius > 28) {
    throw Object.assign(new Error('Corner radius must be between 6 and 28 pixels.'), { status: 400 });
  }
  if (!Number.isSafeInteger(heroOverlay) || heroOverlay < 0 || heroOverlay > 90) {
    throw Object.assign(new Error('Hero image overlay must be between 0 and 90 percent.'), { status: 400 });
  }
  const backgroundStyle = input.backgroundStyle ?? DEFAULT_DESIGN.backgroundStyle;
  if (!['photo', 'pattern', 'both', 'plain'].includes(backgroundStyle)) {
    throw Object.assign(new Error('Choose a supported background style.'), { status: 400 });
  }
  const themePreset = input.themePreset ?? DEFAULT_DESIGN.themePreset;
  if (!['new-burger-bright', 'custom', 'premium-dark'].includes(themePreset)) {
    throw Object.assign(new Error('Choose a supported theme preset.'), { status: 400 });
  }
  for (const key of ['showFeatured', 'showOffers', 'showBenefits']) {
    if (input[key] != null && typeof input[key] !== 'boolean') {
      throw Object.assign(new Error(`${key} must be true or false.`), { status: 400 });
    }
  }
  const localizedContent = {};
  for (const language of ['en', 'ckb', 'ar']) {
    const source = input.localizedContent?.[language] || {};
    localizedContent[language] = {
      heroTitle: optionalText(source.heroTitle, `${language} hero title`, 120),
      heroSubtitle: optionalText(source.heroSubtitle, `${language} hero description`, 300),
      heroButton: optionalText(source.heroButton, `${language} hero button`, 40),
      aboutStory: optionalText(source.aboutStory, `${language} about story`, 2000)
    };
  }
  const rewardsPointsPer1000 = Number(input.rewardsPointsPer1000 ?? 0);
  const rewardsThreshold = Number(input.rewardsThreshold ?? 0);
  if (!Number.isSafeInteger(rewardsPointsPer1000) || rewardsPointsPer1000 < 0 || rewardsPointsPer1000 > 1000 ||
      !Number.isSafeInteger(rewardsThreshold) || rewardsThreshold < 0 || rewardsThreshold > 1000000) {
    throw Object.assign(new Error('Reward points must be non-negative whole numbers within the allowed limits.'), { status: 400 });
  }
  const rewardsDescription = optionalText(input.rewardsDescription, 'Rewards description', 300);
  if ((rewardsPointsPer1000 === 0) !== (rewardsThreshold === 0)) {
    throw Object.assign(new Error('Set both a reward earn rate and redemption threshold, or set both to zero to disable rewards.'), { status: 400 });
  }
  if (rewardsPointsPer1000 > 0 && !rewardsDescription) {
    throw Object.assign(new Error('Describe the reward customers can earn before enabling the rewards program.'), { status: 400 });
  }
  const contactEmail = optionalText(input.contactEmail, 'Contact email', 254);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw Object.assign(new Error('Enter a valid restaurant contact email.'), { status: 400 });
  }
  return {
    restaurantName, logoText, logoImage, backgroundColor, backgroundImage, heroImage, aboutImage,
    themePreset, secondaryBackground, accentColor, goldColor, textColor, mutedColor, cardColor, borderColor,
    cornerRadius, heroOverlay, backgroundStyle,
    showFeatured: input.showFeatured !== false,
    showOffers: input.showOffers !== false,
    showBenefits: input.showBenefits !== false,
    localizedContent,
    aboutStory: optionalText(input.aboutStory, 'Restaurant story', 2000),
    contactPhone: optionalText(input.contactPhone, 'Contact phone', 40),
    contactEmail,
    contactAddress: optionalText(input.contactAddress, 'Contact address', 300),
    rewardsPointsPer1000,
    rewardsThreshold,
    rewardsDescription
  };
}

function validatePromotion(input, id) {
  const title = text(input.title, 'Promotion title', 100);
  const description = text(input.description, 'Promotion description', 500);
  const image = validateImage(optionalText(input.image, 'Promotion image', 500));
  const startsAt = text(input.startsAt, 'Promotion start date', 40);
  const endsAt = text(input.endsAt, 'Promotion end date', 40);
  const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/;
  if (!dateTimePattern.test(startsAt) || !dateTimePattern.test(endsAt)) {
    throw Object.assign(new Error('Promotion dates must include a valid date and time.'), { status: 400 });
  }
  const startTime = Date.parse(startsAt);
  const endTime = Date.parse(endsAt);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    throw Object.assign(new Error('Enter valid promotion dates; the end must be after the start.'), { status: 400 });
  }
  return { id, title, description, image, startsAt: new Date(startTime).toISOString(), endsAt: new Date(endTime).toISOString() };
}

function validateCoupon(input, id) {
  const code = text(input.code, 'Coupon code', 32).toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw Object.assign(new Error('Coupon codes must contain 3 to 32 letters, numbers, hyphens, or underscores.'), { status: 400 });
  }
  const discountType = input.discountType;
  if (!['percentage', 'fixed'].includes(discountType)) {
    throw Object.assign(new Error('Choose a percentage or fixed-amount coupon.'), { status: 400 });
  }
  const amount = Number(input.amount);
  const maximumAmount = discountType === 'percentage' ? 100 : 100000000;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > maximumAmount) {
    throw Object.assign(new Error(discountType === 'percentage'
      ? 'Percentage discounts must be between 1 and 100.'
      : 'Fixed discounts must be a positive whole number in IQD.'), { status: 400 });
  }
  const minimumSubtotal = Number(input.minimumSubtotal ?? 0);
  if (!Number.isSafeInteger(minimumSubtotal) || minimumSubtotal < 0 || minimumSubtotal > 100000000) {
    throw Object.assign(new Error('The minimum subtotal must be a non-negative whole number in IQD.'), { status: 400 });
  }
  const usageLimit = input.usageLimit == null || input.usageLimit === '' ? null : Number(input.usageLimit);
  if (usageLimit !== null && (!Number.isSafeInteger(usageLimit) || usageLimit < 1 || usageLimit > 1000000)) {
    throw Object.assign(new Error('The usage limit must be a positive whole number, or left blank for unlimited use.'), { status: 400 });
  }
  const perCustomerLimit = Number(input.perCustomerLimit ?? 1);
  if (!Number.isSafeInteger(perCustomerLimit) || perCustomerLimit < 1 || perCustomerLimit > 1000) {
    throw Object.assign(new Error('The per-customer limit must be between 1 and 1,000.'), { status: 400 });
  }
  const startsAt = text(input.startsAt, 'Coupon start date', 40);
  const endsAt = text(input.endsAt, 'Coupon end date', 40);
  const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/;
  const startTime = Date.parse(startsAt);
  const endTime = Date.parse(endsAt);
  if (!dateTimePattern.test(startsAt) || !dateTimePattern.test(endsAt) ||
      !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    throw Object.assign(new Error('Enter valid coupon dates; the end must be after the start.'), { status: 400 });
  }
  if (typeof input.active !== 'boolean') {
    throw Object.assign(new Error('Coupon availability must be true or false.'), { status: 400 });
  }
  const deliveryTypes = input.deliveryTypes ?? ['delivery', 'pickup', 'dine-in'];
  if (!Array.isArray(deliveryTypes) || !deliveryTypes.length ||
      deliveryTypes.some(type => !['delivery', 'pickup', 'dine-in'].includes(type)) ||
      new Set(deliveryTypes).size !== deliveryTypes.length) {
    throw Object.assign(new Error('Choose one or more valid order types for this coupon.'), { status: 400 });
  }
  return {
    id, code, discountType, amount, minimumSubtotal, usageLimit, perCustomerLimit,
    startsAt: new Date(startTime).toISOString(),
    endsAt: new Date(endTime).toISOString(),
    deliveryTypes,
    active: input.active
  };
}

function validCoordinate(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw Object.assign(new Error('Enter a valid map location.'), { status: 400 });
  }
  return number;
}

function validateAddress(input) {
  const label = text(input.label, 'Address label', 30);
  if (!['Home', 'Work', 'Other'].includes(label)) {
    throw Object.assign(new Error('Choose Home, Work, or Other for the address label.'), { status: 400 });
  }
  return {
    label,
    city: text(input.city, 'City', 100),
    street: text(input.street, 'Street or area', 150),
    building: text(input.building, 'Building or house', 100),
    unit: optionalText(input.unit, 'Apartment or floor', 100),
    notes: optionalText(input.notes, 'Delivery instructions', 500),
    latitude: validCoordinate(input.latitude, -90, 90),
    longitude: validCoordinate(input.longitude, -180, 180),
    mapAddress: optionalText(input.mapAddress, 'Readable map address', 300)
  };
}

function destinationLink(address) {
  if (!Number.isFinite(address?.latitude) || !Number.isFinite(address?.longitude)) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address.latitude},${address.longitude}`)}`;
}

function publicCustomer(customer) {
  return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, favorites: customer.favorites || [] };
}

function signSession(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function makeSession(id, secret) {
  const expiresAt = Date.now() + SESSION_MAX_AGE;
  const nonce = crypto.randomBytes(24).toString('base64url');
  const value = `${id}.${expiresAt}.${nonce}`;
  return `${value}.${signSession(value, secret)}`;
}

function parseSession(req, cookieName, secret) {
  const value = sessionCookieValue(req, cookieName);
  if (!value) return null;
  const [id, expiresAtText, nonce, signature, ...extra] = value.split('.');
  const unsigned = `${id}.${expiresAtText}.${nonce}`;
  const expiresAt = Number(expiresAtText);
  if (extra.length || !id || !nonce || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() ||
      !equalHash(Buffer.from(signature || '', 'hex'), Buffer.from(signSession(unsigned, secret), 'hex'))) return null;
  return { id, expiresAt };
}

function sessionCookieValue(req, cookieName = SESSION_COOKIE) {
  const cookie = req.headers.cookie || '';
  return cookie.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

function distanceKm(first, second) {
  const radians = value => value * Math.PI / 180;
  const latitude = radians(second.latitude - first.latitude);
  const longitude = radians(second.longitude - first.longitude);
  const a = Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validateOrderItems(store, items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    throw Object.assign(new Error('An order must contain between 1 and 50 different menu items.'), { status: 400 });
  }
  const orderItems = items.map(input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw Object.assign(new Error('Each order item must be a valid object.'), { status: 400 });
    }
    const id = Number(input.id);
    const quantity = Number(input.quantity);
    const item = store.menu.find(menuItem => menuItem.id === id);
    if (!item || item.available === false) throw Object.assign(new Error('One or more selected menu items are no longer available.'), { status: 400 });
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      throw Object.assign(new Error('Item quantities must be between 1 and 99.'), { status: 400 });
    }
    if (input.extras != null && !Array.isArray(input.extras)) {
      throw Object.assign(new Error('Choose valid extras for each menu item.'), { status: 400 });
    }
    const selectedNames = input.extras || [];
    if (selectedNames.length > 20 || selectedNames.some(name => typeof name !== 'string') ||
        new Set(selectedNames).size !== selectedNames.length) {
      throw Object.assign(new Error('Choose valid extras for each menu item.'), { status: 400 });
    }
    const extras = selectedNames.map(name => {
      const extra = item.extras?.find(option => option.name === name);
      if (!extra) throw Object.assign(new Error('One or more selected extras are no longer available.'), { status: 400 });
      return { ...extra };
    });
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity,
      extras,
      instructions: optionalText(input.instructions, 'Item instructions', 250)
    };
  });
  const subtotal = orderItems.reduce((sum, item) =>
    sum + (item.price + item.extras.reduce((extraSum, extra) => extraSum + extra.price, 0)) * item.quantity, 0);
  if (!Number.isSafeInteger(subtotal)) {
    throw Object.assign(new Error('The order subtotal is too large to process.'), { status: 400 });
  }
  return { orderItems, subtotal };
}

function publicReview(review) {
  return {
    id: review.id,
    rating: review.rating,
    displayName: review.displayName || 'Verified customer',
    comment: review.comment,
    createdAt: review.createdAt
  };
}

function adminSessionValid(req, secret, activeSessions, cookieName = SESSION_COOKIE) {
  const session = parseSession(req, cookieName, secret);
  return Boolean(session && activeSessions.get(session.id) === session.expiresAt);
}

function imageFormat(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return null;
}

function createApp(options = {}) {
  const dataFile = options.dataFile || path.join(__dirname, '.data', 'store.json');
  const uploadDir = options.uploadDir || process.env.UPLOAD_DIR || path.join(path.dirname(dataFile), 'uploads');
  const adminEmail = (options.adminEmail ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? '';
  const adminConfigured = Boolean(adminEmail && adminPassword);
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  const app = express();
  const activeSessions = new Map();
  const loginAttempts = new Map();
  const staffLoginAttempts = new Map();
  const customerLoginAttempts = new Map();
  const customerRegistrationAttempts = new Map();
  let store = readStore(dataFile);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));

  const save = () => writeStore(dataFile, store);
  const recordAudit = (req, action, entityType, entityId) => {
    store.auditLogs.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actorId: req.staff.id,
      actorRole: req.staff.role,
      action,
      entityType,
      entityId: String(entityId || '')
    });
    if (store.auditLogs.length > 1000) store.auditLogs.length = 1000;
  };
  const requireAdmin = (req, res, next) => {
    if (!adminConfigured) return res.status(503).json({ error: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD, then restart the server.' });
    if (!adminSessionValid(req, sessionSecret, activeSessions)) return res.status(401).json({ error: 'Please sign in to continue.' });
    req.staff = { id: 'owner', role: 'owner' };
    next();
  };
  const requireStaff = roles => (req, res, next) => {
    const session = parseSession(req, STAFF_COOKIE, sessionSecret);
    if (!session) return res.status(401).json({ error: 'Please sign in to continue.' });
    if (session.id === 'owner' && !adminSessionValid(req, sessionSecret, activeSessions, STAFF_COOKIE)) {
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }
    const staff = session.id === 'owner'
      ? (adminConfigured ? { id: 'owner', role: 'owner', name: 'Owner' } : null)
      : store.staff.find(item => item.id === session.id && item.active !== false);
    if (!staff || !roles.includes(staff.role)) return res.status(403).json({ error: 'You do not have permission to access this resource.' });
    req.staff = staff;
    next();
  };
  const requireCustomer = (req, res, next) => {
    const session = parseSession(req, CUSTOMER_COOKIE, sessionSecret);
    const customer = session && store.customers.find(item => item.id === session.id);
    if (!customer) return res.status(401).json({ error: 'Sign in to access your customer account.' });
    req.customer = customer;
    next();
  };

  const setCookie = (res, req, name, value) => {
    res.cookie(name, value, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure,
      path: '/',
      maxAge: SESSION_MAX_AGE
    });
  };

  const enforceDeliveryArea = address => {
    const area = store.settings.deliveryArea;
    if (!area) return;
    const distance = distanceKm(area, address);
    if (distance > area.radiusKm) {
      throw Object.assign(new Error('This address is outside the restaurant delivery area. Choose pickup or another address.'), { status: 400 });
    }
  };

  const isClosedOrder = order => ['Delivered', 'Collected', 'Completed', 'Cancelled'].includes(order.status);
  const tableAvailability = table => {
    const occupied = store.orders.some(order => order.tableId === table.id && !isClosedOrder(order));
    return occupied ? 'Occupied' : table.status === 'Reserved' ? 'Reserved' : 'Available';
  };
  const validateCouponForOrder = (codeInput, deliveryType, subtotal, customer) => {
    const code = typeof codeInput === 'string' ? codeInput.trim().toUpperCase() : '';
    if (!code) return { coupon: null, discount: 0 };
    const coupon = store.coupons.find(item => item.code === code && item.active);
    const now = Date.now();
    if (!coupon || Date.parse(coupon.startsAt) > now || Date.parse(coupon.endsAt) <= now) {
      throw Object.assign(new Error('This coupon is invalid, inactive, or expired.'), { status: 400 });
    }
    if (!coupon.deliveryTypes.includes(deliveryType)) {
      throw Object.assign(new Error('This coupon is not valid for the selected order type.'), { status: 400 });
    }
    if (subtotal < coupon.minimumSubtotal) {
      throw Object.assign(new Error(`This coupon requires a minimum subtotal of ${coupon.minimumSubtotal} IQD.`), { status: 400 });
    }
    const redemptions = store.orders.filter(order => order.couponId === coupon.id && order.status !== 'Cancelled');
    if (coupon.usageLimit !== null && redemptions.length >= coupon.usageLimit) {
      throw Object.assign(new Error('This coupon has reached its usage limit.'), { status: 400 });
    }
    if (customer && redemptions.filter(order => order.customerId === customer.id).length >= coupon.perCustomerLimit) {
      throw Object.assign(new Error('You have reached this coupon’s per-customer usage limit.'), { status: 400 });
    }
    const discount = Math.min(subtotal, coupon.discountType === 'percentage'
      ? Math.floor(subtotal * coupon.amount / 100)
      : coupon.amount);
    return { coupon, discount };
  };
  const customerForRequest = req => {
    const session = parseSession(req, CUSTOMER_COOKIE, sessionSecret);
    return session && store.customers.find(customer => customer.id === session.id);
  };
  const createOrder = ({ req, deliveryType, items, addressId = '', tableId = '', idempotencyKey = '', guest = false, staff = null, initialStatus = 'Pending approval' }) => {
    if (!['delivery', 'pickup', 'dine-in'].includes(deliveryType)) {
      throw Object.assign(new Error('Choose delivery, pickup, or dine-in.'), { status: 400 });
    }
    const customer = customerForRequest(req);
    const address = deliveryType === 'delivery'
      ? customer?.addresses.find(item => item.id === addressId)
      : null;
    if (deliveryType === 'delivery' && !address) {
      throw Object.assign(new Error(customer ? 'Choose one of your saved delivery addresses.' : 'Sign in to place a delivery order.'), { status: customer ? 400 : 401 });
    }
    if (deliveryType === 'pickup' && !store.settings.pickupEnabled) {
      throw Object.assign(new Error('Pickup is not currently available.'), { status: 400 });
    }
    if (deliveryType === 'dine-in' && !store.settings.dineInEnabled) {
      throw Object.assign(new Error('Dine-in ordering is not currently available.'), { status: 400 });
    }
    if (address) enforceDeliveryArea(address);
    let table = null;
    if (deliveryType === 'dine-in') {
      table = store.tables.find(item => item.id === tableId && item.active !== false);
      if (!table || tableAvailability(table) !== 'Available') {
        throw Object.assign(new Error('Choose an available dine-in table.'), { status: 400 });
      }
    }
    if (deliveryType === 'delivery' && !customer) {
      throw Object.assign(new Error('Sign in to place a delivery order.'), { status: 401 });
    }
    if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
      throw Object.assign(new Error('A unique checkout request key is required.'), { status: 400 });
    }
    const requestOwner = customer?.id || `guest:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const keyHash = hash(`${requestOwner}:${idempotencyKey}`).toString('hex');
    const existingRequest = store.orderKeys.find(item => item.hash === keyHash);
    if (existingRequest) {
      throw Object.assign(new Error('This order request was already received. Check order tracking before trying again.'), { status: 409, orderId: existingRequest.orderId });
    }
    const { orderItems, subtotal } = validateOrderItems(store, items);
    if (subtotal < store.settings.minimumOrder) {
      throw Object.assign(new Error(`The minimum order is ${store.settings.minimumOrder} IQD.`), { status: 400 });
    }
    const { coupon, discount } = validateCouponForOrder(req.body?.couponCode, deliveryType, subtotal, customer);
    const deliveryFee = deliveryType === 'delivery' ? store.settings.deliveryFee : 0;
    const payment = deliveryType === 'delivery'
      ? 'Cash on delivery'
      : deliveryType === 'pickup' ? 'Cash at pickup' : 'Cash at table';
    if (req.body?.payment && req.body.payment !== payment && !(staff && req.body.payment === 'Cash')) {
      throw Object.assign(new Error('The selected payment method is not available for this order.'), { status: 400 });
    }
    const total = subtotal - discount + deliveryFee;
    if (!Number.isSafeInteger(total)) {
      throw Object.assign(new Error('The order total is too large to process.'), { status: 400 });
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const addressSnapshot = address ? {
      id: address.id, label: address.label, city: address.city, street: address.street,
      building: address.building, unit: address.unit, notes: address.notes,
      latitude: address.latitude, longitude: address.longitude,
      mapAddress: address.mapAddress, mapLink: destinationLink(address)
    } : null;
    const guestName = optionalText(req.body?.customerName, 'Customer name', 100);
    const guestPhone = optionalText(req.body?.customerPhone, 'Customer phone', 40);
    const order = {
      id: `NB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      createdAt: new Date().toISOString(),
      customerId: customer?.id || null,
      customer: customer
        ? { name: customer.name, phone: customer.phone }
        : { name: guestName || (staff ? 'Walk-in customer' : 'Guest customer'), phone: guestPhone },
      source: staff ? 'walk-in' : 'online',
      deliveryType,
      orderType: deliveryType,
      tableId: table?.id || null,
      tableNumber: table?.number || '',
      address: addressSnapshot,
      payment,
      paymentStatus: req.body?.paymentStatus === 'Paid' && staff ? 'Paid' : 'Pending',
      ...(req.body?.paymentStatus === 'Paid' && staff
        ? { paymentConfirmedAt: new Date().toISOString(), paymentConfirmedBy: staff.id }
        : {}),
      items: orderItems,
      subtotal,
      deliveryFee,
      discount,
      couponId: coupon?.id || null,
      couponCode: coupon?.code || '',
      total,
      status: initialStatus,
      history: [{ status: initialStatus, at: new Date().toISOString(), ...(staff ? { staffId: staff.id } : {}) }],
      trackingTokenHash: hash(token).toString('hex')
    };
    store.orders.unshift(order);
    store.orderKeys.push({ hash: keyHash, orderId: order.id });
    if (staff) recordAudit(req, 'order.created', 'order', order.id);
    save();
    const { trackingTokenHash, ...responseOrder } = order;
    return { order: responseOrder, trackingToken: token, paymentConfirmed: order.paymentStatus === 'Paid' };
  };

  app.post('/api/customer/register', async (req, res, next) => {
    try {
      const now = Date.now();
      const address = req.ip || req.socket.remoteAddress || 'unknown';
      const cutoff = now - 15 * 60 * 1000;
      const attempts = (customerRegistrationAttempts.get(address) || []).filter(attempt => attempt > cutoff);
      if (attempts.length >= 10) {
        return res.status(429).json({ error: 'Too many account creation attempts. Wait 15 minutes and try again.' });
      }
      attempts.push(now);
      customerRegistrationAttempts.set(address, attempts);
      if (customerRegistrationAttempts.size > 1000) {
        for (const [ip, recorded] of customerRegistrationAttempts) {
          if (!recorded.some(attempt => attempt > cutoff)) customerRegistrationAttempts.delete(ip);
        }
        if (customerRegistrationAttempts.size > 1000) customerRegistrationAttempts.delete(customerRegistrationAttempts.keys().next().value);
      }
      const name = text(req.body?.name, 'Name', 100);
      const phone = text(req.body?.phone, 'Phone number', 40);
      const email = text(req.body?.email, 'Email', 254).toLowerCase();
      const password = req.body?.password;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
      }
      if (typeof password !== 'string' || password.length < 10 || password.length > 200) {
        throw Object.assign(new Error('Password must be between 10 and 200 characters.'), { status: 400 });
      }
      if (store.customers.some(customer => customer.email === email)) {
        throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
      }
      const salt = crypto.randomBytes(16);
      const passwordHash = await scrypt(password, salt, 64);
      const customer = { id: crypto.randomUUID(), name, email, phone, passwordSalt: salt.toString('hex'), passwordHash: passwordHash.toString('hex'), addresses: [], favorites: [] };
      store.customers.push(customer);
      save();
      setCookie(res, req, CUSTOMER_COOKIE, makeSession(customer.id, sessionSecret));
      res.status(201).json({ customer: publicCustomer(customer) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/customer/login', async (req, res, next) => {
    try {
      const now = Date.now();
      const key = req.ip || req.socket.remoteAddress || 'unknown';
      const attempts = (customerLoginAttempts.get(key) || []).filter(attempt => attempt > now - 15 * 60 * 1000);
      if (attempts.length >= 10) return res.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' });
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
      }
      if (!password || password.length > 200) {
        throw Object.assign(new Error('Enter a password of at most 200 characters.'), { status: 400 });
      }
      const customer = store.customers.find(item => item.email === email);
      const salt = Buffer.from(customer?.passwordSalt || '00000000000000000000000000000000', 'hex');
      const expected = Buffer.from(customer?.passwordHash || crypto.randomBytes(64).toString('hex'), 'hex');
      const actual = await scrypt(password, salt, 64);
      if (!customer || !equalHash(actual, expected)) {
        attempts.push(now);
        customerLoginAttempts.set(key, attempts);
        if (customerLoginAttempts.size > 1000) {
          const cutoff = now - 15 * 60 * 1000;
          for (const [ip, recorded] of customerLoginAttempts) {
            if (!recorded.some(attempt => attempt > cutoff)) customerLoginAttempts.delete(ip);
          }
          if (customerLoginAttempts.size > 1000) customerLoginAttempts.delete(customerLoginAttempts.keys().next().value);
        }
        return res.status(401).json({ error: 'Email or password is incorrect.' });
      }
      customerLoginAttempts.delete(key);
      setCookie(res, req, CUSTOMER_COOKIE, makeSession(customer.id, sessionSecret));
      res.json({ customer: publicCustomer(customer) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/customer/session', (req, res) => {
    const session = parseSession(req, CUSTOMER_COOKIE, sessionSecret);
    const customer = session && store.customers.find(item => item.id === session.id);
    res.json({ authenticated: Boolean(customer), customer: customer ? publicCustomer(customer) : null });
  });

  app.post('/api/customer/logout', (req, res) => {
    res.clearCookie(CUSTOMER_COOKIE, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });
    res.status(204).end();
  });

  app.get('/api/customer/account', requireCustomer, (req, res) => {
    const { passwordSalt, passwordHash, ...customer } = req.customer;
    res.json(customer);
  });

  app.put('/api/customer/account', requireCustomer, (req, res, next) => {
    try {
      const name = text(req.body?.name, 'Name', 100);
      const phone = text(req.body?.phone, 'Phone number', 40);
      const email = text(req.body?.email, 'Email', 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
      }
      if (store.customers.some(customer => customer.id !== req.customer.id && customer.email === email)) {
        throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
      }
      Object.assign(req.customer, { name, phone, email });
      save();
      res.json(publicCustomer(req.customer));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/customer/addresses', requireCustomer, (req, res, next) => {
    try {
      if (req.customer.addresses.length >= 25) {
        throw Object.assign(new Error('You can save up to 25 addresses.'), { status: 400 });
      }
      const address = { id: crypto.randomUUID(), ...validateAddress(req.body || {}), isDefault: Boolean(req.body?.isDefault) || req.customer.addresses.length === 0 };
      if (address.isDefault) req.customer.addresses.forEach(item => { item.isDefault = false; });
      req.customer.addresses.push(address);
      save();
      res.status(201).json(address);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/customer/addresses/:id', requireCustomer, (req, res, next) => {
    try {
      const address = req.customer.addresses.find(item => item.id === req.params.id);
      if (!address) return res.status(404).json({ error: 'Saved address not found.' });
      const updated = validateAddress(req.body || {});
      if (req.body?.isDefault) req.customer.addresses.forEach(item => { item.isDefault = false; });
      Object.assign(address, updated, { isDefault: Boolean(req.body?.isDefault) || address.isDefault });
      save();
      res.json(address);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/customer/addresses/:id/default', requireCustomer, (req, res) => {
    const address = req.customer.addresses.find(item => item.id === req.params.id);
    if (!address) return res.status(404).json({ error: 'Saved address not found.' });
    req.customer.addresses.forEach(item => { item.isDefault = item.id === address.id; });
    save();
    res.json(address);
  });

  app.delete('/api/customer/addresses/:id', requireCustomer, (req, res) => {
    const index = req.customer.addresses.findIndex(item => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Saved address not found.' });
    const wasDefault = req.customer.addresses[index].isDefault;
    req.customer.addresses.splice(index, 1);
    if (wasDefault && req.customer.addresses.length) req.customer.addresses[0].isDefault = true;
    save();
    res.status(204).end();
  });

  app.get('/api/customer/orders', requireCustomer, (req, res) => {
    const orders = store.orders.filter(order => order.customerId === req.customer.id).map(({ trackingTokenHash, ...order }) => order);
    res.json(orders);
  });
  app.put('/api/customer/favorites', requireCustomer, (req, res, next) => {
    try {
      const ids = req.body?.ids;
      if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => !Number.isSafeInteger(Number(id)) || !store.menu.some(item => item.id === Number(id)))) {
        throw Object.assign(new Error('Choose valid products for your favorites.'), { status: 400 });
      }
      req.customer.favorites = [...new Set(ids.map(Number))];
      save();
      res.json({ favorites: req.customer.favorites });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/checkout/quote', (req, res, next) => {
    try {
      const deliveryType = req.body?.deliveryType || 'delivery';
      if (!['delivery', 'pickup', 'dine-in'].includes(deliveryType)) {
        throw Object.assign(new Error('Choose delivery, pickup, or dine-in.'), { status: 400 });
      }
      const customer = customerForRequest(req);
      const address = deliveryType === 'delivery'
        ? customer?.addresses.find(item => item.id === req.body?.addressId)
        : null;
      if (deliveryType === 'delivery' && !address) {
        throw Object.assign(new Error(customer ? 'Choose one of your saved delivery addresses.' : 'Sign in to place a delivery order.'), { status: customer ? 400 : 401 });
      }
      if (address) enforceDeliveryArea(address);
      if (deliveryType === 'pickup' && !store.settings.pickupEnabled) {
        throw Object.assign(new Error('Pickup is not currently available.'), { status: 400 });
      }
      if (deliveryType === 'dine-in' && !store.settings.dineInEnabled) {
        throw Object.assign(new Error('Dine-in ordering is not currently available.'), { status: 400 });
      }
      if (deliveryType === 'dine-in') {
        const table = store.tables.find(item => item.id === req.body?.tableId && item.active !== false);
        if (!table || tableAvailability(table) !== 'Available') {
          throw Object.assign(new Error('Choose an available dine-in table.'), { status: 400 });
        }
      }
      const { subtotal } = validateOrderItems(store, req.body?.items);
      if (subtotal < store.settings.minimumOrder) {
        throw Object.assign(new Error(`The minimum order is ${store.settings.minimumOrder} IQD.`), { status: 400 });
      }
      const { coupon, discount } = validateCouponForOrder(req.body?.couponCode, deliveryType, subtotal, customer);
      const deliveryFee = deliveryType === 'delivery' ? store.settings.deliveryFee : 0;
      res.json({
        subtotal, discount, couponCode: coupon?.code || '', deliveryFee, total: subtotal - discount + deliveryFee,
        payment: deliveryType === 'delivery' ? 'Cash on delivery' : deliveryType === 'pickup' ? 'Cash at pickup' : 'Cash at table',
        paymentStatus: 'Pending'
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/menu', (req, res) => res.json(store.menu));
  app.get('/api/delivery-options', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      deliveryFee: store.settings.deliveryFee,
      minimumOrder: store.settings.minimumOrder,
      pickupEnabled: store.settings.pickupEnabled,
      dineInEnabled: store.settings.dineInEnabled,
      deliveryAreaEnabled: Boolean(store.settings.deliveryArea)
    });
  });
  app.get('/api/dine-in/tables', (req, res) => {
    if (!store.settings.dineInEnabled) return res.json([]);
    res.json(store.tables.filter(table => table.active !== false && tableAvailability(table) === 'Available')
      .map(({ id, number }) => ({ id, number })));
  });
  app.get('/api/design', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(store.design);
  });
  app.get('/api/promotions', (req, res) => {
    const now = Date.now();
    res.set('Cache-Control', 'public, max-age=60');
    res.json(store.promotions.filter(promotion =>
      Date.parse(promotion.startsAt) <= now && Date.parse(promotion.endsAt) > now
    ));
  });
  app.get('/api/reviews', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(store.reviews.filter(review => review.approved).map(publicReview));
  });

  app.post('/api/reviews', (req, res) => {
    const order = store.orders.find(item => item.id === req.body?.orderId);
    const suppliedToken = req.get('x-order-token') || '';
    if (!order || !equalHash(hash(suppliedToken), Buffer.from(order.trackingTokenHash, 'hex'))) {
      return res.status(404).json({ error: 'Completed order not found.' });
    }
    if (!['Delivered', 'Collected', 'Completed'].includes(order.status)) {
      return res.status(400).json({ error: 'Reviews can be submitted after the order is completed, collected, or delivered.' });
    }
    if (store.reviews.some(review => review.orderId === order.id)) {
      return res.status(409).json({ error: 'A review has already been submitted for this order.' });
    }
    const rating = Number(req.body?.rating);
    if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
    }
    try {
      const review = {
        id: crypto.randomUUID(),
        orderId: order.id,
        rating,
        comment: text(req.body?.comment, 'Review', 1000),
        displayName: optionalText(req.body?.displayName, 'Display name', 60),
        createdAt: new Date().toISOString(),
        approved: false
      };
      store.reviews.unshift(review);
      save();
      res.status(201).json({ message: 'Thank you. Your review will appear after restaurant approval.' });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });

  app.post('/api/orders', (req, res, next) => {
    try {
      const result = createOrder({
        req,
        deliveryType: req.body?.deliveryType || 'delivery',
        items: req.body?.items,
        addressId: req.body?.addressId,
        tableId: req.body?.tableId,
        idempotencyKey: req.get('idempotency-key') || ''
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/orders/:id', (req, res) => {
    const order = store.orders.find(item => item.id === req.params.id);
    const suppliedToken = req.get('x-order-token') || '';
    if (!order || !equalHash(hash(suppliedToken), Buffer.from(order.trackingTokenHash, 'hex'))) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({
      id: order.id,
      createdAt: order.createdAt,
      items: order.items,
      total: order.total,
      status: order.status,
      rewardPoints: order.rewardPoints || 0,
      deliveryType: order.deliveryType,
      orderType: order.orderType || order.deliveryType,
      tableNumber: order.tableNumber || '',
      payment: order.payment,
      paymentStatus: order.paymentStatus,
      address: order.address
    });
  });

  app.get('/api/admin/session', (req, res) => {
    res.json({ configured: adminConfigured, authenticated: adminConfigured && adminSessionValid(req, sessionSecret, activeSessions), role: adminSessionValid(req, sessionSecret, activeSessions) ? 'owner' : null });
  });

  app.post('/api/admin/login', (req, res) => {
    if (!adminConfigured) {
      return res.status(503).json({ error: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD, then restart the server.' });
    }
    const now = Date.now();
    const cutoff = now - 15 * 60 * 1000;
    const address = req.ip || req.socket.remoteAddress || 'unknown';
    const recentAttempts = (loginAttempts.get(address) || []).filter(attempt => attempt > cutoff);
    if (recentAttempts.length >= 10) {
      return res.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' });
    }
    const suppliedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const suppliedPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!equalHash(hash(suppliedEmail), hash(adminEmail)) || !equalHash(hash(suppliedPassword), hash(adminPassword))) {
      recentAttempts.push(now);
      loginAttempts.set(address, recentAttempts);
      if (loginAttempts.size > 1000) {
        for (const [ip, attempts] of loginAttempts) {
          if (!attempts.some(attempt => attempt > cutoff)) loginAttempts.delete(ip);
        }
        if (loginAttempts.size > 1000) loginAttempts.delete(loginAttempts.keys().next().value);
      }
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    loginAttempts.delete(address);

    for (const [sessionId, expiry] of activeSessions) {
      if (expiry <= Date.now()) activeSessions.delete(sessionId);
    }
    const session = makeSession('owner', sessionSecret);
    const expiresAt = Number(session.split('.')[1]);
    activeSessions.set('owner', expiresAt);
    setCookie(res, req, SESSION_COOKIE, session);
    setCookie(res, req, STAFF_COOKIE, session);
    res.json({ authenticated: true });
  });

  app.post('/api/staff/login', async (req, res, next) => {
    try {
      const now = Date.now();
      const cutoff = now - 15 * 60 * 1000;
      const address = req.ip || req.socket.remoteAddress || 'unknown';
      const recentAttempts = (staffLoginAttempts.get(address) || []).filter(attempt => attempt > cutoff);
      if (recentAttempts.length >= 10) {
        return res.status(429).json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' });
      }
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const staff = store.staff.find(item => item.email === email && item.active !== false);
      const salt = Buffer.from(staff?.passwordSalt || '00000000000000000000000000000000', 'hex');
      const expected = Buffer.from(staff?.passwordHash || crypto.randomBytes(64).toString('hex'), 'hex');
      const actual = await scrypt(password, salt, 64);
      if (!staff || !equalHash(actual, expected)) {
        recentAttempts.push(now);
        staffLoginAttempts.set(address, recentAttempts);
        if (staffLoginAttempts.size > 1000) {
          for (const [ip, attempts] of staffLoginAttempts) {
            if (!attempts.some(attempt => attempt > cutoff)) staffLoginAttempts.delete(ip);
          }
          if (staffLoginAttempts.size > 1000) staffLoginAttempts.delete(staffLoginAttempts.keys().next().value);
        }
        return res.status(401).json({ error: 'Email or password is incorrect.' });
      }
      staffLoginAttempts.delete(address);
      setCookie(res, req, STAFF_COOKIE, makeSession(staff.id, sessionSecret));
      res.json({ authenticated: true, role: staff.role, name: staff.name });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/staff/session', requireStaff(['owner', 'cashier', 'driver', 'kitchen']), (req, res) => {
    res.json({ authenticated: true, role: req.staff.role, name: req.staff.name || 'Owner' });
  });

  app.post('/api/staff/logout', (req, res) => {
    if (adminSessionValid(req, sessionSecret, activeSessions, STAFF_COOKIE)) activeSessions.delete('owner');
    res.clearCookie(STAFF_COOKIE, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });
    res.status(204).end();
  });

  app.post('/api/admin/logout', (req, res) => {
    if (adminSessionValid(req, sessionSecret, activeSessions)) activeSessions.delete('owner');
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });
    res.clearCookie(STAFF_COOKIE, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });
    res.status(204).end();
  });

  app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    res.json(store.auditLogs.slice(0, limit));
  });
  app.get('/api/admin/menu', requireAdmin, (req, res) => res.json(store.menu));
  app.get('/api/admin/design', requireAdmin, (req, res) => res.json(store.design));
  app.get('/api/admin/design/draft', requireAdmin, (req, res) => res.json({
    design: store.designDraft || store.design,
    hasDraft: Boolean(store.designDraft)
  }));
  app.put('/api/admin/design/draft', requireAdmin, (req, res, next) => {
    try {
      const draft = store.designDraft || store.design;
      store.designDraft = validateDesign({ ...draft, ...(req.body || {}) });
      recordAudit(req, 'website-design.draft-saved', 'website-design', 'draft');
      save();
      res.json({ design: store.designDraft, hasDraft: true });
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/admin/design/publish', requireAdmin, (req, res) => {
    if (!store.designDraft) return res.status(400).json({ error: 'Save a website design draft before publishing.' });
    store.previousDesign = store.design;
    store.design = store.designDraft;
    store.designDraft = null;
    recordAudit(req, 'website-design.published', 'website-design', 'design');
    save();
    res.json(store.design);
  });
  app.post('/api/admin/design/restore', requireAdmin, (req, res) => {
    if (!store.previousDesign) return res.status(400).json({ error: 'There is no previous published design to restore.' });
    const current = store.design;
    store.design = validateDesign(store.previousDesign);
    store.previousDesign = current;
    store.designDraft = null;
    recordAudit(req, 'website-design.previous-version-restored', 'website-design', 'design');
    save();
    res.json(store.design);
  });
  app.post('/api/admin/uploads', requireAdmin, express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '5mb'
  }), (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Choose a JPG, PNG, or WebP image to upload.' });
    }
    const format = imageFormat(req.body);
    if (!format || req.is(format.contentType) !== format.contentType) {
      return res.status(400).json({ error: 'The image contents do not match a supported JPG, PNG, or WebP file.' });
    }
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o750 });
    const filename = `${crypto.randomUUID()}.${format.extension}`;
    fs.writeFileSync(path.join(uploadDir, filename), req.body, { flag: 'wx', mode: 0o640 });
    recordAudit(req, 'website-image.uploaded', 'website-image', filename);
    save();
    res.status(201).json({
      url: `/uploads/${filename}`,
      contentType: format.contentType,
      bytes: req.body.length
    });
  });
  app.delete('/api/admin/uploads/:filename', requireAdmin, (req, res, next) => {
    const filename = req.params.filename;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid uploaded image reference.' });
    }
    const url = `/uploads/${filename}`;
    const previous = store.previousDesign || {};
    const used = [
      store.design.logoImage, store.design.backgroundImage, store.design.heroImage,
      store.design.aboutImage,
      store.designDraft?.logoImage, store.designDraft?.backgroundImage, store.designDraft?.heroImage, store.designDraft?.aboutImage,
      previous.logoImage, previous.backgroundImage, previous.heroImage, previous.aboutImage,
      ...store.menu.map(item => item.image),
      ...store.promotions.map(item => item.image)
    ].includes(url);
    if (used) return res.status(409).json({ error: 'This image is still used by saved website content. Remove its reference and save first.' });
    fs.unlink(path.join(uploadDir, filename), error => {
      if (error?.code === 'ENOENT') return res.status(404).json({ error: 'Uploaded image not found.' });
      if (error) return next(error);
      recordAudit(req, 'website-image.deleted', 'website-image', filename);
      save();
      res.status(204).end();
    });
  });
  app.get('/api/admin/delivery-settings', requireAdmin, (req, res) => res.json(store.settings));
  app.put('/api/admin/delivery-settings', requireAdmin, (req, res, next) => {
    try {
      const deliveryFee = Number(req.body?.deliveryFee);
      const minimumOrder = Number(req.body?.minimumOrder);
      if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0 || deliveryFee > 100000000 ||
          !Number.isSafeInteger(minimumOrder) || minimumOrder < 0 || minimumOrder > 100000000) {
        throw Object.assign(new Error('Delivery fee and minimum order must be non-negative whole amounts in IQD.'), { status: 400 });
      }
      if (typeof req.body?.pickupEnabled !== 'boolean') {
        throw Object.assign(new Error('Choose whether pickup is enabled.'), { status: 400 });
      }
      const dineInEnabled = req.body?.dineInEnabled ?? store.settings.dineInEnabled;
      if (typeof dineInEnabled !== 'boolean') {
        throw Object.assign(new Error('Choose whether dine-in ordering is enabled.'), { status: 400 });
      }
      let deliveryArea = null;
      if (req.body?.deliveryArea) {
        deliveryArea = {
          latitude: validCoordinate(req.body.deliveryArea.latitude, -90, 90),
          longitude: validCoordinate(req.body.deliveryArea.longitude, -180, 180),
          radiusKm: Number(req.body.deliveryArea.radiusKm)
        };
        if (!Number.isFinite(deliveryArea.radiusKm) || deliveryArea.radiusKm <= 0 || deliveryArea.radiusKm > 250) {
          throw Object.assign(new Error('Delivery radius must be greater than zero and at most 250 km.'), { status: 400 });
        }
      }
      store.settings = { ...store.settings, deliveryFee, minimumOrder, pickupEnabled: req.body.pickupEnabled, dineInEnabled, deliveryArea };
      recordAudit(req, 'delivery-settings.updated', 'restaurant-settings', 'delivery');
      save();
      res.json(store.settings);
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/admin/staff', requireAdmin, (req, res) => res.json(store.staff.map(({ passwordSalt, passwordHash, ...staff }) => staff)));
  app.get('/api/admin/coupons', requireAdmin, (req, res) => res.json(store.coupons.map(coupon => ({
    ...coupon,
    usageCount: store.orders.filter(order => order.couponId === coupon.id && order.status !== 'Cancelled').length
  }))));
  app.post('/api/admin/coupons', requireAdmin, (req, res, next) => {
    try {
      const coupon = validateCoupon(req.body || {}, crypto.randomUUID());
      if (store.coupons.some(item => item.code === coupon.code)) {
        throw Object.assign(new Error('A coupon already uses this code.'), { status: 409 });
      }
      store.coupons.unshift(coupon);
      recordAudit(req, 'coupon.created', 'coupon', coupon.id);
      save();
      res.status(201).json({ ...coupon, usageCount: 0 });
    } catch (error) {
      next(error);
    }
  });
  app.put('/api/admin/coupons/:id', requireAdmin, (req, res, next) => {
    try {
      const index = store.coupons.findIndex(coupon => coupon.id === req.params.id);
      if (index < 0) return res.status(404).json({ error: 'Coupon not found.' });
      const coupon = validateCoupon(req.body || {}, req.params.id);
      if (store.coupons.some(item => item.id !== coupon.id && item.code === coupon.code)) {
        throw Object.assign(new Error('A coupon already uses this code.'), { status: 409 });
      }
      store.coupons[index] = coupon;
      recordAudit(req, 'coupon.updated', 'coupon', coupon.id);
      save();
      res.json({ ...coupon, usageCount: store.orders.filter(order => order.couponId === coupon.id && order.status !== 'Cancelled').length });
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
    const index = store.coupons.findIndex(coupon => coupon.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Coupon not found.' });
    const [coupon] = store.coupons.splice(index, 1);
    recordAudit(req, 'coupon.deleted', 'coupon', coupon.id);
    save();
    res.status(204).end();
  });
  app.post('/api/admin/staff', requireAdmin, async (req, res, next) => {
    try {
      const name = text(req.body?.name, 'Staff name', 100);
      const email = text(req.body?.email, 'Staff email', 254).toLowerCase();
      const password = req.body?.password;
      const role = req.body?.role;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid staff email.'), { status: 400 });
      if (!['cashier', 'driver', 'kitchen'].includes(role)) throw Object.assign(new Error('Staff role must be cashier, kitchen, or driver.'), { status: 400 });
      if (typeof password !== 'string' || password.length < 12 || password.length > 200) throw Object.assign(new Error('Staff password must be at least 12 characters.'), { status: 400 });
      if (email === adminEmail || store.staff.some(item => item.email === email)) throw Object.assign(new Error('A staff account already uses this email.'), { status: 409 });
      const salt = crypto.randomBytes(16);
      const passwordHash = await scrypt(password, salt, 64);
      const staff = { id: crypto.randomUUID(), name, email, role, active: true, passwordSalt: salt.toString('hex'), passwordHash: passwordHash.toString('hex') };
      store.staff.push(staff);
      recordAudit(req, 'staff.created', 'staff-account', staff.id);
      save();
      const { passwordSalt, passwordHash: hiddenHash, ...response } = staff;
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  });
  app.patch('/api/admin/staff/:id', requireAdmin, (req, res, next) => {
    try {
      const staff = store.staff.find(item => item.id === req.params.id);
      if (!staff) return res.status(404).json({ error: 'Staff account not found.' });
      if (typeof req.body?.active !== 'boolean') throw Object.assign(new Error('Choose whether this staff account is active.'), { status: 400 });
      staff.active = req.body.active;
      if (req.body.active === false) {
        for (const order of store.orders) {
          if (order.driverId === staff.id && !['Delivered', 'Cancelled'].includes(order.status)) {
            order.driverId = null;
            order.status = 'Ready';
            order.history.push({ status: 'Ready', at: new Date().toISOString(), note: 'Driver account deactivated; delivery assignment cleared.' });
          }
        }
      }
      recordAudit(req, req.body.active ? 'staff.enabled' : 'staff.disabled', 'staff-account', staff.id);
      save();
      const { passwordSalt, passwordHash, ...response } = staff;
      res.json(response);
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/admin/staff/:id', requireAdmin, (req, res) => {
    const index = store.staff.findIndex(item => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Staff account not found.' });
    const [staff] = store.staff.splice(index, 1);
    recordAudit(req, 'staff.deleted', 'staff-account', staff.id);
    for (const order of store.orders) {
      if (order.driverId === staff.id && !['Delivered', 'Cancelled'].includes(order.status)) {
        order.driverId = null;
        order.status = 'Ready';
        order.history.push({ status: 'Ready', at: new Date().toISOString(), note: 'Driver removed; delivery assignment cleared.' });
      }
    }
    save();
    res.status(204).end();
  });
  app.get('/api/admin/tables', requireAdmin, (req, res) => {
    res.json(store.tables.map(table => ({ ...table, status: tableAvailability(table) })));
  });
  app.post('/api/admin/tables', requireAdmin, (req, res, next) => {
    try {
      const number = text(req.body?.number, 'Table number', 30);
      if (store.tables.some(table => table.number.toLowerCase() === number.toLowerCase())) {
        throw Object.assign(new Error('A table already uses this number.'), { status: 409 });
      }
      const table = { id: crypto.randomUUID(), number, status: 'Available', active: true };
      store.tables.push(table);
      recordAudit(req, 'table.created', 'table', table.id);
      save();
      res.status(201).json({ ...table, status: tableAvailability(table) });
    } catch (error) {
      next(error);
    }
  });
  app.patch('/api/admin/tables/:id', requireAdmin, (req, res, next) => {
    try {
      const table = store.tables.find(item => item.id === req.params.id);
      if (!table) return res.status(404).json({ error: 'Table not found.' });
      const number = text(req.body?.number, 'Table number', 30);
      if (store.tables.some(item => item.id !== table.id && item.number.toLowerCase() === number.toLowerCase())) {
        throw Object.assign(new Error('A table already uses this number.'), { status: 409 });
      }
      if (typeof req.body?.reserved !== 'boolean') {
        throw Object.assign(new Error('Choose whether this table is reserved.'), { status: 400 });
      }
      if (tableAvailability(table) === 'Occupied' && req.body.reserved) {
        throw Object.assign(new Error('An occupied table cannot be reserved.'), { status: 409 });
      }
      table.number = number;
      table.status = req.body.reserved ? 'Reserved' : 'Available';
      recordAudit(req, req.body.reserved ? 'table.reserved' : 'table.updated', 'table', table.id);
      save();
      res.json({ ...table, status: tableAvailability(table) });
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/admin/tables/:id', requireAdmin, (req, res) => {
    const index = store.tables.findIndex(item => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Table not found.' });
    const table = store.tables[index];
    if (tableAvailability(table) === 'Occupied') return res.status(409).json({ error: 'An occupied table cannot be removed.' });
    store.tables.splice(index, 1);
    recordAudit(req, 'table.deleted', 'table', req.params.id);
    save();
    res.status(204).end();
  });
  app.get('/api/admin/promotions', requireAdmin, (req, res) => res.json(store.promotions));
  app.get('/api/admin/reviews', requireAdmin, (req, res) => res.json(store.reviews));

  app.get('/api/staff/orders', requireStaff(['owner', 'cashier']), (req, res) => {
    res.json(store.orders.map(({ trackingTokenHash, ...order }) => order));
  });

  app.get('/api/staff/tables', requireStaff(['owner', 'cashier']), (req, res) => {
    res.json(store.tables.filter(table => table.active !== false)
      .map(table => ({ ...table, status: tableAvailability(table) })));
  });

  app.post('/api/staff/walk-in-orders', requireStaff(['owner', 'cashier']), (req, res, next) => {
    try {
      const deliveryType = req.body?.deliveryType;
      if (!['pickup', 'dine-in'].includes(deliveryType)) {
        throw Object.assign(new Error('Walk-in orders must be pickup or dine-in.'), { status: 400 });
      }
      const result = createOrder({
        req,
        deliveryType,
        items: req.body?.items,
        tableId: req.body?.tableId,
        idempotencyKey: req.get('idempotency-key') || '',
        staff: req.staff,
        initialStatus: 'Confirmed'
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/kitchen/orders', requireStaff(['owner', 'kitchen']), (req, res) => {
    res.json(store.orders.filter(order => ['Confirmed', 'Preparing', 'Ready'].includes(order.status))
      .map(order => ({
        id: order.id,
        createdAt: order.createdAt,
        orderType: order.orderType || order.deliveryType,
        tableNumber: order.tableNumber || '',
        items: order.items,
        status: order.status
      })));
  });

  app.patch('/api/kitchen/orders/:id/status', requireStaff(['owner', 'kitchen']), (req, res) => {
    const order = store.orders.find(item => item.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const allowed = order.status === 'Confirmed' ? ['Preparing'] : order.status === 'Preparing' ? ['Ready'] : [];
    if (!allowed.includes(req.body?.status)) {
      return res.status(400).json({ error: 'Kitchen staff may move confirmed orders to Preparing and preparing orders to Ready.' });
    }
    order.status = req.body.status;
    order.history.push({ status: order.status, at: new Date().toISOString(), staffId: req.staff.id });
    recordAudit(req, 'kitchen.order-status-changed', 'order', order.id);
    recordAudit(req, 'order.status-changed', 'order', order.id);
    save();
    res.json({ id: order.id, status: order.status });
  });

  app.get('/api/staff/delivery-map', requireStaff(['owner', 'cashier']), (req, res) => {
    res.json(store.orders.filter(order => order.deliveryType === 'delivery' && order.address?.latitude != null)
      .map(order => ({
        id: order.id,
        status: order.status,
        customer: order.customer,
        address: order.address,
        total: order.total,
        assignedDriverName: store.staff.find(staff => staff.id === order.driverId)?.name || ''
      })));
  });

  app.patch('/api/staff/orders/:id/status', requireStaff(['owner', 'cashier']), (req, res) => {
    const order = store.orders.find(item => item.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const status = req.body?.status;
    const allowed = order.status === 'Pending approval'
      ? ['Confirmed', 'Cancelled']
      : order.status === 'Ready' && order.deliveryType === 'pickup'
        ? ['Collected', 'Cancelled']
        : order.status === 'Ready' && order.deliveryType === 'dine-in'
          ? ['Served', 'Cancelled']
          : order.status === 'Served' && order.deliveryType === 'dine-in'
            ? ['Completed']
            : [];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'This order cannot move to that status from its current state.' });
    order.status = status;
    order.history.push({ status, at: new Date().toISOString(), staffId: req.staff.id });
    recordAudit(req, 'order.status-changed', 'order', order.id);
    save();
    res.json({ id: order.id, status: order.status });
  });

  app.patch('/api/staff/orders/:id/payment', requireStaff(['owner', 'cashier']), (req, res) => {
    const order = store.orders.find(item => item.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (req.body?.paymentStatus !== 'Paid' || order.paymentStatus !== 'Pending') {
      return res.status(400).json({ error: 'Only pending cash payments can be confirmed as collected.' });
    }
    order.paymentStatus = 'Paid';
    order.paymentConfirmedAt = new Date().toISOString();
    order.paymentConfirmedBy = req.staff.id;
    recordAudit(req, 'payment.cash-confirmed', 'order', order.id);
    save();
    res.json({ id: order.id, paymentStatus: order.paymentStatus, paymentConfirmedAt: order.paymentConfirmedAt });
  });

  app.get('/api/driver/orders', requireStaff(['driver']), (req, res) => {
    res.json(store.orders.filter(order => order.driverId === req.staff.id)
      .map(({ trackingTokenHash, ...order }) => order));
  });

  app.patch('/api/driver/orders/:id/status', requireStaff(['driver']), (req, res) => {
    const order = store.orders.find(item => item.id === req.params.id && item.driverId === req.staff.id);
    if (!order) return res.status(404).json({ error: 'Assigned delivery not found.' });
    const status = req.body?.status;
    const allowedTransitions = order.status === 'Assigned'
      ? ['Picked Up', 'Delivery problem']
      : order.status === 'Picked Up' || order.status === 'Out for delivery'
        ? ['Out for delivery', 'Delivered', 'Delivery problem']
        : [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({ error: 'This delivery cannot be moved to that status.' });
    }
    let problem = '';
    if (status === 'Delivery problem') {
      problem = text(req.body?.problem, 'Delivery problem details', 500);
      order.deliveryProblem = { message: problem, at: new Date().toISOString(), driverId: req.staff.id };
    }
    order.status = status;
      if (['Delivered', 'Collected', 'Completed'].includes(status) && !order.rewardPointsAwarded) {
      order.rewardPoints = Math.floor(order.total / 1000) * store.design.rewardsPointsPer1000;
      order.rewardPointsAwarded = true;
    }
    order.history.push({ status, at: new Date().toISOString(), staffId: req.staff.id, ...(problem ? { note: problem } : {}) });
    recordAudit(req, 'driver.delivery-status-changed', 'order', order.id);
    recordAudit(req, 'delivery.status-changed', 'order', order.id);
    save();
    res.json({ id: order.id, status: order.status });
  });

  app.post('/api/admin/promotions', requireAdmin, (req, res, next) => {
    try {
      const id = crypto.randomUUID();
      const promotion = validatePromotion(req.body || {}, id);
      store.promotions.unshift(promotion);
      recordAudit(req, 'promotion.created', 'promotion', id);
      save();
      res.status(201).json(promotion);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/promotions/:id', requireAdmin, (req, res, next) => {
    try {
      const index = store.promotions.findIndex(promotion => promotion.id === req.params.id);
      if (index < 0) return res.status(404).json({ error: 'Promotion not found.' });
      store.promotions[index] = validatePromotion(req.body || {}, req.params.id);
      recordAudit(req, 'promotion.updated', 'promotion', req.params.id);
      save();
      res.json(store.promotions[index]);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/promotions/:id', requireAdmin, (req, res) => {
    const index = store.promotions.findIndex(promotion => promotion.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Promotion not found.' });
    store.promotions.splice(index, 1);
    recordAudit(req, 'promotion.deleted', 'promotion', req.params.id);
    save();
    res.status(204).end();
  });

  app.patch('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    const review = store.reviews.find(item => item.id === req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    if (typeof req.body?.approved !== 'boolean') {
      return res.status(400).json({ error: 'Choose whether to approve this review.' });
    }
    review.approved = req.body.approved;
    recordAudit(req, review.approved ? 'review.approved' : 'review.hidden', 'review', review.id);
    save();
    res.json({ review: publicReview(review), approved: review.approved });
  });

  app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    const index = store.reviews.findIndex(item => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: 'Review not found.' });
    store.reviews.splice(index, 1);
    recordAudit(req, 'review.deleted', 'review', req.params.id);
    save();
    res.status(204).end();
  });

  app.put('/api/admin/design', requireAdmin, (req, res, next) => {
    try {
      const updatedDesign = validateDesign({ ...store.design, ...(req.body || {}) });
      store.previousDesign = store.design;
      store.design = updatedDesign;
      store.designDraft = null;
      recordAudit(req, 'restaurant-settings.updated', 'restaurant-settings', 'design');
      save();
      res.json(store.design);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/menu', requireAdmin, (req, res, next) => {
    try {
      const item = { id: Math.max(0, ...store.menu.map(existing => existing.id)) + 1, ...validateMenuItem(req.body || {}) };
      store.menu.push(item);
      recordAudit(req, 'menu.created', 'menu-item', item.id);
      save();
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/admin/menu/:id', requireAdmin, (req, res, next) => {
    try {
      const index = store.menu.findIndex(item => item.id === Number(req.params.id));
      if (index < 0) return res.status(404).json({ error: 'Menu item not found.' });
      store.menu[index] = { id: store.menu[index].id, ...validateMenuItem(req.body || {}) };
      recordAudit(req, 'menu.updated', 'menu-item', store.menu[index].id);
      save();
      res.json(store.menu[index]);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/admin/menu/:id', requireAdmin, (req, res) => {
    const index = store.menu.findIndex(item => item.id === Number(req.params.id));
    if (index < 0) return res.status(404).json({ error: 'Menu item not found.' });
    const [item] = store.menu.splice(index, 1);
    recordAudit(req, 'menu.deleted', 'menu-item', item.id);
    save();
    res.status(204).end();
  });

  app.get('/api/admin/orders', requireAdmin, (req, res) => {
    res.json(store.orders.map(({ trackingTokenHash, ...order }) => order));
  });

  app.post('/api/admin/orders/:id/assign', requireAdmin, (req, res) => {
    const order = store.orders.find(item => item.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const driver = store.staff.find(item => item.id === req.body?.driverId && item.role === 'driver' && item.active !== false);
    if (!driver) return res.status(400).json({ error: 'Choose an active driver account.' });
    if (order.deliveryType !== 'delivery' || !order.address) return res.status(400).json({ error: 'Only delivery orders can be assigned to a driver.' });
    if (!['Ready', 'Assigned', 'Delivery problem'].includes(order.status)) return res.status(409).json({ error: 'Mark the delivery Ready before assigning a driver.' });
    order.driverId = driver.id;
    order.status = 'Assigned';
    order.history.push({ status: 'Assigned', at: new Date().toISOString(), staffId: req.staff.id, note: `Assigned to ${driver.name}.` });
    recordAudit(req, 'order.driver-assigned', 'order', order.id);
    save();
    const { trackingTokenHash, ...response } = order;
    res.json(response);
  });

  app.get('/api/admin/analytics', requireAdmin, (req, res) => {
    const { from, to, deliveryType, status, paymentStatus, productId, staffId } = req.query;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const validDate = value => !value || (datePattern.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);
    if (!validDate(from) || !validDate(to) ||
        (from && to && from > to) ||
        (deliveryType && !['delivery', 'pickup', 'dine-in'].includes(deliveryType)) ||
        (status && !STATUSES.includes(status)) ||
        (paymentStatus && !['Pending', 'Paid'].includes(paymentStatus)) ||
        (productId && !Number.isSafeInteger(Number(productId))) ||
        (staffId && staffId.length > 100)) {
      return res.status(400).json({ error: 'One or more report filters are invalid.' });
    }
    const orders = store.orders.filter(order =>
      (!from || order.createdAt.slice(0, 10) >= from) &&
      (!to || order.createdAt.slice(0, 10) <= to) &&
      (!deliveryType || order.deliveryType === deliveryType) &&
      (!status || order.status === status) &&
      (!paymentStatus || order.paymentStatus === paymentStatus) &&
      (!productId || order.items.some(item => item.id === Number(productId))) &&
      (!staffId || order.driverId === staffId || order.history.some(entry => entry.staffId === staffId))
    );
    const completed = orders.filter(order => ['Delivered', 'Collected', 'Completed'].includes(order.status));
    const collected = completed.filter(order => order.paymentStatus === 'Paid');
    const nonCancelled = orders.filter(order => order.status !== 'Cancelled');
    const today = new Date().toISOString().slice(0, 10);
    const ordersToday = store.orders.filter(order => order.createdAt.slice(0, 10) === today);
    const collectedToday = store.orders.filter(order =>
      order.createdAt.slice(0, 10) === today &&
      ['Delivered', 'Collected', 'Completed'].includes(order.status) &&
      order.paymentStatus === 'Paid'
    );
    const filteredCollectedToday = collected.filter(order => order.createdAt.slice(0, 10) === today);
    const totalOrderValue = nonCancelled.reduce((sum, order) => sum + order.total, 0);
    const collectedRevenue = collected.reduce((sum, order) => sum + order.total, 0);
    const byDay = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return {
        date: key,
        total: collected.filter(order => order.createdAt.slice(0, 10) === key)
          .reduce((sum, order) => sum + order.total, 0)
      };
    });
    const bestSellers = new Map();
    for (const order of completed) {
      for (const item of order.items) {
        bestSellers.set(item.name, (bestSellers.get(item.name) || 0) + item.quantity);
      }
    }
    res.json({
      totalOrders: orders.length,
      completedOrders: completed.length,
      cancelledOrders: orders.filter(order => order.status === 'Cancelled').length,
      pendingOrders: orders.filter(order => !isClosedOrder(order)).length,
      todayOrders: ordersToday.length,
      todayRevenue: collectedToday.reduce((sum, order) => sum + order.total, 0),
      todaySales: filteredCollectedToday.reduce((sum, order) => sum + order.total, 0),
      totalOrderValue,
      collectedRevenue,
      pendingPaymentAmount: nonCancelled.filter(order => order.paymentStatus !== 'Paid').reduce((sum, order) => sum + order.total, 0),
      deliveryFees: completed.reduce((sum, order) => sum + order.deliveryFee, 0),
      discounts: completed.reduce((sum, order) => sum + order.discount, 0),
      averageOrderValue: completed.length ? Math.round(completed.reduce((sum, order) => sum + order.total, 0) / completed.length) : 0,
      salesByType: ['delivery', 'pickup', 'dine-in'].map(type => {
        const typeOrders = completed.filter(order => order.deliveryType === type);
        return {
          type,
          completedOrders: typeOrders.length,
          orderValue: typeOrders.reduce((sum, order) => sum + order.total, 0),
          collectedRevenue: typeOrders.filter(order => order.paymentStatus === 'Paid').reduce((sum, order) => sum + order.total, 0)
        };
      }),
      byDay,
      bestSellers: [...bestSellers].map(([name, quantity]) => ({ name, quantity }))
        .sort((left, right) => right.quantity - left.quantity).slice(0, 5),
      unavailableItems: store.menu.filter(item => item.available === false).map(({ id, name }) => ({ id, name }))
    });
  });

  app.patch('/api/admin/orders/:id', requireAdmin, (req, res, next) => {
    try {
      const order = store.orders.find(item => item.id === req.params.id);
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      const status = text(req.body?.status, 'Status', 40);
      if (!STATUSES.includes(status)) {
        throw Object.assign(new Error('Choose a valid order status.'), { status: 400 });
      }
      const validForType = order.deliveryType === 'delivery'
        ? ['Pending approval', 'Confirmed', 'Preparing', 'Ready', 'Assigned', 'Picked Up', 'Out for delivery', 'Delivery problem', 'Delivered', 'Cancelled']
        : order.deliveryType === 'pickup'
          ? ['Pending approval', 'Confirmed', 'Preparing', 'Ready', 'Collected', 'Cancelled']
          : ['Pending approval', 'Confirmed', 'Preparing', 'Ready', 'Served', 'Completed', 'Cancelled'];
      const transitions = {
        'Pending approval': ['Confirmed', 'Cancelled'],
        Confirmed: ['Preparing', 'Cancelled'],
        Preparing: ['Ready', 'Cancelled'],
        Ready: order.deliveryType === 'delivery' ? ['Assigned', 'Cancelled'] : order.deliveryType === 'pickup' ? ['Collected', 'Cancelled'] : ['Served', 'Cancelled'],
        Assigned: ['Picked Up', 'Delivery problem', 'Cancelled'],
        'Picked Up': ['Out for delivery', 'Delivered', 'Delivery problem'],
        'Out for delivery': ['Delivered', 'Delivery problem'],
        'Delivery problem': ['Assigned', 'Cancelled'],
        Served: ['Completed']
      };
      if (!validForType.includes(status) || !transitions[order.status]?.includes(status)) {
        throw Object.assign(new Error('This order cannot move to that status from its current state.'), { status: 400 });
      }
      if (status === 'Delivered' && order.deliveryType === 'delivery' && !order.driverId) {
        throw Object.assign(new Error('Assign a driver before marking a delivery delivered.'), { status: 400 });
      }
        if (['Delivered', 'Collected', 'Completed'].includes(status) && !order.rewardPointsAwarded) {
        order.rewardPoints = Math.floor(order.total / 1000) * store.design.rewardsPointsPer1000;
        order.rewardPointsAwarded = true;
      }
      order.status = status;
      order.history.push({ status, at: new Date().toISOString() });
      recordAudit(req, 'order.status-changed', 'order', order.id);
      save();
      const { trackingTokenHash, ...responseOrder } = order;
      res.json(responseOrder);
    } catch (error) {
      next(error);
    }
  });

  app.get('/menu', (req, res, next) => {
    res.sendFile(path.join(__dirname, 'index.html'), error => {
      if (error) next(error);
    });
  });
  app.use('/uploads', express.static(uploadDir, {
    dotfiles: 'deny',
    fallthrough: true,
    immutable: true,
    maxAge: '1y',
    setHeaders: response => response.setHeader('X-Content-Type-Options', 'nosniff')
  }));
  app.use(express.static(__dirname, { dotfiles: 'deny' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status >= 500 ? 'The server could not complete the request.' : error.message });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, '0.0.0.0', () => {
    console.log(`New Burger is available on port ${port}`);
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) console.warn('Admin login is disabled until ADMIN_EMAIL and ADMIN_PASSWORD are configured.');
    if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET is not set; admin sessions will expire when the server restarts.');
  });
}

module.exports = { createApp };
