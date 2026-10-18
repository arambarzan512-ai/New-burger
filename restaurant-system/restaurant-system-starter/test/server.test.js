const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApp } = require('../server');

const TEST_MENU = [
  { id: 1, name: 'Test House Burger', category: 'Burgers', price: 8500, desc: 'Integration test item', extras: [], available: true },
  { id: 2, name: 'Test Chicken Burger', category: 'Burgers', price: 7500, desc: 'Integration test item', extras: [], available: true },
  { id: 3, name: 'Test Fries', category: 'Sides', price: 4500, desc: 'Integration test item', extras: [], available: true },
  { id: 4, name: 'Test Pizza', category: 'Pizza', price: 9000, desc: 'Integration test item', extras: [], available: true },
  { id: 8, name: 'Test Drink', category: 'Drinks', price: 2500, desc: 'Integration test item', extras: [], available: true }
];

function writeTestStore(dataFile, menu = TEST_MENU) {
  fs.writeFileSync(dataFile, JSON.stringify({
    menu,
    orders: [],
    design: { restaurantName: 'New Burger', logoText: 'NB' }
  }));
}

test('menu, orders, admin controls, and data persist through the API', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'new-burger-restaurant-'));
  const dataFile = path.join(directory, 'store.json');
  writeTestStore(dataFile);
  let server;

  async function startServer() {
    server = http.createServer(createApp({
      dataFile,
      adminEmail: 'admin@example.test',
      adminPassword: 'correct horse battery staple',
      sessionSecret: 'test-session-secret-that-is-long-enough'
    }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }

  async function stopServer() {
    if (!server) return;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server = null;
  }

  try {
    let base = await startServer();
    const customerPage = await fetch(`${base}/`);
    assert.equal(customerPage.status, 200);
    const customerHtml = await customerPage.text();
    assert.match(customerHtml, /<body class="customer-site">/);
    assert.match(customerHtml, /New Burger home/);
    assert.match(customerHtml, /id="heroImage"/);
    assert.doesNotMatch(customerHtml, /id="themeBtn"/, 'customer theme switch is removed');
    assert.match(customerHtml, /id="menuGrid"/);
    const customerMenu = customerHtml.match(/<nav class="customer-menu"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(customerMenu, 'customer navigation drawer is present');
    const mainCustomerMenu = customerMenu.replace(/<ul class="settings-submenu"[\s\S]*?<\/ul>/, '');
    assert.deepEqual([...mainCustomerMenu.matchAll(/<span data-i18n>(.*?)<\/span>/g)].map(match => match[1]), [
      'Home', 'Our Menu', 'My Orders / Order Tracking', 'Settings', 'Offers &amp; Promotions',
      'Favorites', 'Reviews &amp; Feedback', 'Loyalty &amp; Rewards', 'Contact Us'
    ]);
    assert.match(customerMenu, /href="#home"/);
    assert.match(customerMenu, /href="\/menu"/);
    assert.match(customerMenu, /id="ordersMenuBtn"/);
    assert.match(customerMenu, /id="settingsToggle"[^>]*aria-controls="settingsSubmenu"/);
    assert.match(customerMenu, /id="languageMenuBtn"/);
    assert.match(customerMenu, /id="aboutMenuBtn"/);
    assert.match(customerHtml, /id="menuTrigger"[^>]*aria-controls="customerMenu"/);
    assert.match(customerHtml, /id="home"/);
    assert.match(customerHtml, /id="menu"/);
    const menuPage = await fetch(`${base}/menu`);
    assert.equal(menuPage.status, 200);
    assert.match(await menuPage.text(), /id="menuGrid"/, 'standalone menu route serves the ordering menu');
    assert.match(customerHtml, /<a href="\/menu" aria-label="Our Menu">/, 'bottom menu link navigates in the same tab');
    assert.doesNotMatch(customerHtml, /<a href="\/menu"[^>]*target="_blank"/, 'menu link does not open a new tab');
    assert.match(customerHtml, /class="cart-count"[^>]*id="cartCount"[^>]*hidden/, 'top cart badge starts hidden until items are added');
    assert.match(customerHtml, /id="floatingCartBar"[^>]*hidden/, 'floating cart summary starts hidden');
    const customerClient = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const checkoutClient = customerClient.slice(
      customerClient.indexOf('async function checkoutModal()'),
      customerClient.indexOf('\nfunction renderCheckoutAddress')
    );
    assert.match(customerClient, /data-password-toggle="accountPassword"/, 'customer sign-in includes a password visibility control');
    assert.match(customerClient, /passwordToggle\.setAttribute\('aria-pressed', String\(showPassword\)\)/, 'password visibility state is accessible');
    assert.match(customerHtml, /class="desktop-customer-nav"/, 'customer header includes desktop navigation');
    assert.match(customerHtml, /href="\/#offers"/, 'desktop offers navigation has a real destination');
    assert.match(checkoutClient, /<label for="paymentMethod" data-i18n>Cash Payment Only<\/label>/, 'payment selection label states cash only');
    assert.match(checkoutClient, /Cash payments only\. All orders are strictly for delivery or takeaway — no dine-in available\./, 'checkout explains cash-only delivery/takeaway policy');
    assert.match(customerClient, /value="Cash on delivery".*Cash on Delivery/s, 'payment options include cash on delivery');
    assert.match(customerClient, /value="Cash at pickup".*Cash at Store \(Takeaway\)/s, 'payment options include cash at store takeaway');
    assert.match(customerClient, /payment = deliveryType === 'delivery' \? 'Cash on delivery' : 'Cash at pickup'/, 'order submission sends the server-supported payment value for its delivery type');
    assert.match(customerClient, /floatingBar\.hidden = count === 0 \|\| !\$\(\'#modalBackdrop\'\)\.classList\.contains\(\'hidden\'\)/, 'floating cart bar hides while checkout or another modal is open');
    assert.match(customerClient, /\$\('#floatingCartBar'\)\.hidden = true/, 'opening a modal hides the floating cart bar');
    assert.match(checkoutClient, /Takeout &amp; Delivery Only: All orders are prepared for takeaway or delivery\. Dine-in is not available\./, 'checkout displays the takeout and delivery policy');
    assert.doesNotMatch(checkoutClient, /value="dine-in"|Dine-in table/, 'customer checkout does not offer dine-in');
    assert.match(customerClient, /data-product-add-control aria-label="\$\{escapeHTML\(localized\('Add to cart'\)\)\}/, 'product cards start with an Add to Cart button');
    assert.match(customerClient, /data-product-stepper\$\{quantity === 0 \? ' hidden' : ''\}/, 'quantity stepper is hidden when quantity is zero');
    assert.match(customerClient, /addControl\.hidden = quantity > 0/, 'Add to Cart button hides after first addition');
    assert.match(customerClient, /stepper\.hidden = quantity === 0/, 'quantity stepper returns to Add to Cart at zero');
    assert.match(customerClient, /data-cart-remove="\$\{item\.id\}"/, 'product cards include decrement quantity controls');
    assert.match(customerClient, /data-cart-add="\$\{item\.id\}" aria-label="\$\{escapeHTML\(localized\('Add one'\)\)/, 'product cards include increment quantity controls');
    assert.match(customerClient, /function changeProductQuantity\(id, delta\)/, 'product card quantity controls update cart state');
    assert.match(customerClient, /function renderProductQuantities\(\)/, 'product card quantities stay synchronized with cart updates');
    assert.match(customerClient, /function showCartButtonFeedback\(button\)/, 'quantity increases have momentary visual feedback');
    assert.match(customerClient, /}, 450\)\)/, 'quantity feedback is momentary');
    assert.match(customerClient, /\$\('#floatingCartTotal'\)\.textContent = money\(total\)/, 'floating cart total updates from cart contents');
    assert.match(customerClient, /floatingBar\.hidden = count === 0/);
    assert.match(customerClient, /\$\('#cartCount'\)\.hidden = count === 0/);
    assert.match(customerClient, /\$\('#cartBtn'\)\.setAttribute\('aria-label'/);
    assert.match(customerClient, /changeProductQuantity\(Number\(button\.dataset\.cartAdd\), 1\)/);
    assert.doesNotMatch(customerClient, /dar_theme|classList\.toggle\('dark'\)/, 'customer dark/light mode switching is removed');
    for (const id of [
      'ordersMenuBtn', 'settingsToggle', 'languageMenuBtn', 'aboutMenuBtn',
      'promotionsMenuBtn', 'favoritesMenuBtn', 'reviewsMenuBtn', 'rewardsMenuBtn', 'contactMenuBtn',
      'bottomFavoritesBtn', 'bottomOrdersBtn', 'bottomCartBtn'
    ]) {
      assert.match(customerClient, new RegExp(`\\$\\('#${id}'\\)\\.addEventListener\\('click'`), `${id} has a click handler`);
    }
    assert.match(customerClient, /function openLanguageModal/);
    assert.match(customerClient, /function openAboutModal/);
    assert.match(customerClient, /ckb: \{ label: 'Kurdish Sorani'.*direction: 'rtl'/);
    assert.match(customerClient, /ar: \{ label: 'Arabic'.*direction: 'rtl'/);
    assert.match(customerClient, /document\.documentElement\.dir = LANGUAGES\[language\]\.direction/);
    assert.match(customerClient, /localStorage\.setItem\('dar_favorites'/);
    assert.match(customerClient, /id="applyCouponBtn"/);
    assert.match(customerClient, /couponCode/);
    assert.match(customerClient, /api\('\/api\/promotions'\)/);
    assert.match(customerClient, /api\('\/api\/reviews'\)/);
    assert.match(customerClient, /'X-Order-Token': String\(fields\.get\('trackingToken'\)\)\.trim\(\)/);
    assert.match(customerClient, /id="orderLookupForm"/);
    assert.match(customerClient, /'X-Order-Token': token/);
    const adminPage = await fetch(`${base}/admin.html`);
    assert.equal(adminPage.status, 200);
    const adminHtml = await adminPage.text();
    assert.match(adminHtml, /id="analyticsCards"/);
    assert.match(adminHtml, /id="email"[^>]*type="email"/);
    assert.match(adminHtml, /id="couponForm"/);
    assert.match(adminHtml, /id="reportFilters"/);
    assert.match(adminHtml, /id="auditLogList"/);
    assert.doesNotMatch(adminHtml, /id="themeBtn"/, 'admin theme switch is removed');
    assert.match(adminHtml, /id="heroUpload"[^>]*accept="image\/jpeg,image\/png,image\/webp/);
    assert.match(adminHtml, /id="aboutUpload"[^>]*accept="image\/jpeg,image\/png,image\/webp/);
    assert.match(adminHtml, /id="itemUpload"[^>]*accept="image\/jpeg,image\/png,image\/webp/);
    assert.match(adminHtml, /id="publishDesignBtn"/);
    assert.match(adminHtml, /id="previewDesignBtn"/);
    for (const page of ['/cashier.html', '/driver.html']) {
      assert.equal((await fetch(`${base}${page}`)).status, 200);
    }
    assert.doesNotMatch(customerHtml, /href="admin\.html"/, 'customer navigation does not expose the admin page');
    const menuResponse = await fetch(`${base}/api/menu`);
    assert.equal(menuResponse.status, 200);
    const seededMenu = await menuResponse.json();
    assert.equal(seededMenu.length, TEST_MENU.length);
    const privateData = await fetch(`${base}/.data/store.json`);
    assert.equal(privateData.status, 404);

    const denied = await fetch(`${base}/api/admin/menu`);
    assert.equal(denied.status, 401);
    assert.equal((await fetch(`${base}/api/admin/analytics`)).status, 401);
    const badLogin = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'wrong password' })
    });
    assert.equal(badLogin.status, 401);
    for (const credentials of [
      { password: 'correct horse battery staple' },
      { email: 'other@example.test', password: 'correct horse battery staple' },
      { email: 'admin@example.test', password: 'wrong password' }
    ]) {
      const rejected = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      assert.equal(rejected.status, 401);
    }
    const login = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ' ADMIN@EXAMPLE.TEST ', password: 'correct horse battery staple' })
    });
    assert.equal(login.status, 200);
    const ownerCookies = login.headers.getSetCookie().map(value => value.split(';')[0]);
    const cookie = ownerCookies.find(value => value.startsWith('dar_admin_session='));
    const staffCookie = ownerCookies.find(value => value.startsWith('dar_staff_session='));
    const allOwnerCookies = ownerCookies.join('; ');
    assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);

    const adminHeaders = { Cookie: cookie, 'Content-Type': 'application/json' };
    const ownerStaffHeaders = { Cookie: staffCookie, 'Content-Type': 'application/json' };
    const unauthorizedUpload = await fetch(`${base}/api/admin/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    });
    assert.equal(unauthorizedUpload.status, 401, 'image uploads require owner authorization');
    const currentDesign = await fetch(`${base}/api/admin/design`, { headers: { Cookie: cookie } });
    assert.equal(currentDesign.status, 200);
    assert.equal((await currentDesign.json()).restaurantName, 'New Burger');
    const deliverySettings = await fetch(`${base}/api/admin/delivery-settings`, { headers: { Cookie: cookie } });
    assert.equal(deliverySettings.status, 200);
    const saveDeliverySettings = await fetch(`${base}/api/admin/delivery-settings`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ deliveryFee: 500, minimumOrder: 0, pickupEnabled: true, deliveryArea: null })
    });
    assert.equal(saveDeliverySettings.status, 200);
    assert.equal((await (await fetch(`${base}/api/delivery-options`)).json()).deliveryFee, 500);
    const unauthenticatedDesign = await fetch(`${base}/api/admin/design`);
    assert.equal(unauthenticatedDesign.status, 401);
    const promotionStart = new Date(Date.now() - 60_000).toISOString();
    const promotionEnd = new Date(Date.now() + 60_000).toISOString();
    const createPromotion = await fetch(`${base}/api/admin/promotions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ title: 'Test offer', description: 'Valid on test orders only.', startsAt: promotionStart, endsAt: promotionEnd })
    });
    assert.equal(createPromotion.status, 201);
    const promotion = await createPromotion.json();
    assert.equal((await (await fetch(`${base}/api/promotions`)).json()).length, 1);
    const futurePromotion = await fetch(`${base}/api/admin/promotions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Future test offer',
        description: 'Not valid yet.',
        startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      })
    });
    assert.equal(futurePromotion.status, 201);
    const futurePromotionResult = await futurePromotion.json();
    assert.equal((await (await fetch(`${base}/api/promotions`)).json()).length, 1, 'future promotions are not shown');
    const updatePromotion = await fetch(`${base}/api/admin/promotions/${promotion.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        title: 'Updated test offer',
        description: 'Updated terms.',
        startsAt: promotionStart,
        endsAt: promotionEnd
      })
    });
    assert.equal(updatePromotion.status, 200);
    assert.equal((await updatePromotion.json()).title, 'Updated test offer');
    const invalidPromotion = await fetch(`${base}/api/admin/promotions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ title: 'Invalid dates', description: 'Test', startsAt: promotionEnd, endsAt: promotionStart })
    });
    assert.equal(invalidPromotion.status, 400);
    const malformedPromotionDate = await fetch(`${base}/api/admin/promotions`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ title: 'Malformed date', description: 'Test', startsAt: '1', endsAt: promotionEnd })
    });
    assert.equal(malformedPromotionDate.status, 400);
    const updateDesign = await fetch(`${base}/api/admin/design`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        restaurantName: 'Test Cafe',
        logoText: 'TC',
        logoImage: 'https://example.test/logo.png',
        backgroundColor: '#aabbcc',
        backgroundImage: '/images/restaurant%20background.jpg',
        heroImage: '',
        aboutImage: '',
        themePreset: 'premium-dark',
        secondaryBackground: '#1c1a18',
        accentColor: '#f28a24',
        goldColor: '#d6aa5b',
        textColor: '#f7f3ec',
        mutedColor: '#b9b1a7',
        cardColor: '#211f1c',
        borderColor: '#39342e',
        cornerRadius: 14,
        heroOverlay: 48,
        backgroundStyle: 'pattern',
        showFeatured: true,
        showOffers: true,
        showBenefits: true,
        localizedContent: {
          en: { heroTitle: '', heroSubtitle: '', heroButton: '', aboutStory: '' },
          ckb: { heroTitle: '', heroSubtitle: '', heroButton: '', aboutStory: '' },
          ar: { heroTitle: '', heroSubtitle: '', heroButton: '', aboutStory: '' }
        },
        aboutStory: 'A genuine restaurant story.',
        contactPhone: '+964 750 000 0000',
        contactEmail: 'hello@example.test',
        contactAddress: 'Erbil',
        rewardsPointsPer1000: 2,
        rewardsThreshold: 20,
        rewardsDescription: 'Ask staff to redeem at checkout.'
      })
    });
    assert.equal(updateDesign.status, 200);
    assert.deepEqual(await updateDesign.json(), {
      restaurantName: 'Test Cafe',
      logoText: 'TC',
      logoImage: 'https://example.test/logo.png',
      backgroundColor: '#aabbcc',
      backgroundImage: '/images/restaurant%20background.jpg',
      heroImage: '',
      aboutImage: '',
      themePreset: 'premium-dark',
      secondaryBackground: '#1c1a18',
      accentColor: '#f28a24',
      goldColor: '#d6aa5b',
      textColor: '#f7f3ec',
      mutedColor: '#b9b1a7',
      cardColor: '#211f1c',
      borderColor: '#39342e',
      cornerRadius: 14,
      heroOverlay: 48,
      backgroundStyle: 'pattern',
      showFeatured: true,
      showOffers: true,
      showBenefits: true,
      localizedContent: {
        en: { heroTitle: '', heroSubtitle: '', heroButton: '', aboutStory: '' },
        ckb: { heroTitle: '', heroSubtitle: '', heroButton: '', aboutStory: '' },
        ar: { heroTitle: '', heroSubtitle: '', heroButton: '', aboutStory: '' }
      },
      aboutStory: 'A genuine restaurant story.',
      contactPhone: '+964 750 000 0000',
      contactEmail: 'hello@example.test',
      contactAddress: 'Erbil',
      rewardsPointsPer1000: 2,
      rewardsThreshold: 20,
      rewardsDescription: 'Ask staff to redeem at checkout.'
    });
    const invalidDesign = await fetch(`${base}/api/admin/design`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        restaurantName: 'Bad color',
        logoText: 'X',
        logoImage: 'javascript:alert(1)',
        backgroundColor: 'red',
        backgroundImage: ''
      })
    });
    assert.equal(invalidDesign.status, 400);
    const incompleteRewards = await fetch(`${base}/api/admin/design`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        restaurantName: 'Incomplete rewards',
        backgroundColor: '#ffffff',
        rewardsPointsPer1000: 1,
        rewardsThreshold: 10,
        rewardsDescription: ''
      })
    });
    assert.equal(incompleteRewards.status, 400);
    const publicDesign = await fetch(`${base}/api/design`);
    assert.equal((await publicDesign.json()).restaurantName, 'Test Cafe');

    const uploadHeaders = { Cookie: cookie, 'Content-Type': 'image/png' };
    const invalidUploadFile = await fetch(`${base}/api/admin/uploads`, {
      method: 'POST',
      headers: uploadHeaders,
      body: Buffer.from('not an image')
    });
    assert.equal(invalidUploadFile.status, 400, 'image contents are checked, not just the extension');
    const tooLargeImage = await fetch(`${base}/api/admin/uploads`, {
      method: 'POST',
      headers: uploadHeaders,
      body: Buffer.alloc(5 * 1024 * 1024 + 1, 0)
    });
    assert.equal(tooLargeImage.status, 413, 'image size is bounded server-side');
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const upload = await fetch(`${base}/api/admin/uploads`, {
      method: 'POST',
      headers: uploadHeaders,
      body: validPng
    });
    assert.equal(upload.status, 201);
    const uploadedImage = await upload.json();
    assert.match(uploadedImage.url, /^\/uploads\/[0-9a-f-]{36}\.png$/);
    assert.deepEqual([...new Uint8Array(await (await fetch(`${base}${uploadedImage.url}`)).arrayBuffer())], [...validPng]);
    const activeBeforePublish = await (await fetch(`${base}/api/design`)).json();
    const draftDesign = {
      ...activeBeforePublish,
      heroImage: uploadedImage.url,
      accentColor: '#e98222',
      localizedContent: {
        ...activeBeforePublish.localizedContent,
        en: { ...activeBeforePublish.localizedContent.en, heroTitle: 'Fresh from the grill' }
      }
    };
    const saveDesignDraft = await fetch(`${base}/api/admin/design/draft`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(draftDesign)
    });
    assert.equal(saveDesignDraft.status, 200);
    assert.equal((await (await fetch(`${base}/api/design`)).json()).heroImage, '', 'draft remains private');
    const publishDesign = await fetch(`${base}/api/admin/design/publish`, {
      method: 'POST',
      headers: { Cookie: cookie }
    });
    assert.equal(publishDesign.status, 200);
    assert.equal((await (await fetch(`${base}/api/design`)).json()).heroImage, uploadedImage.url);
    const deletePublishedImage = await fetch(`${base}/api/admin/uploads/${uploadedImage.url.split('/').pop()}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(deletePublishedImage.status, 409, 'referenced images cannot be deleted');
    const replacementUpload = await fetch(`${base}/api/admin/uploads`, {
      method: 'POST',
      headers: uploadHeaders,
      body: validPng
    });
    assert.equal(replacementUpload.status, 201);
    const replacementImage = await replacementUpload.json();
    const replaceDesign = await fetch(`${base}/api/admin/design/draft`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ ...(await (await fetch(`${base}/api/design`)).json()), heroImage: replacementImage.url })
    });
    assert.equal(replaceDesign.status, 200);
    assert.equal((await fetch(`${base}/api/admin/design/publish`, { method: 'POST', headers: { Cookie: cookie } })).status, 200);
    assert.equal((await (await fetch(`${base}/api/design`)).json()).heroImage, replacementImage.url, 'published replacement is live');
    const deleteOrphanWithoutLogin = await fetch(`${base}/api/admin/uploads/${uploadedImage.url.split('/').pop()}`, { method: 'DELETE' });
    assert.equal(deleteOrphanWithoutLogin.status, 401);
    const deleteOrphan = await fetch(`${base}/api/admin/uploads/${uploadedImage.url.split('/').pop()}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(deleteOrphan.status, 409, 'previous-version image is retained for restore');
    const unusedUpload = await fetch(`${base}/api/admin/uploads`, {
      method: 'POST',
      headers: uploadHeaders,
      body: validPng
    });
    assert.equal(unusedUpload.status, 201);
    const unusedImage = await unusedUpload.json();
    const deleteUnused = await fetch(`${base}/api/admin/uploads/${unusedImage.url.split('/').pop()}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(deleteUnused.status, 204, 'unreferenced image deletion succeeds');
    assert.equal((await fetch(`${base}${unusedImage.url}`)).status, 404);
    assert.equal((await (await fetch(`${base}/api/promotions`)).json()).length, 1);
    assert.equal((await (await fetch(`${base}/api/reviews`)).json()).length, 0);

    const createItem = await fetch(`${base}/api/admin/menu`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Test special',
        category: 'Specials',
        price: 12500,
        desc: 'A test menu item',
        image: 'https://example.test/dish.jpg',
        ingredients: ['Beef', 'Cheese'],
        extras: [{ name: 'Extra cheese', price: 1000 }],
        prepTime: 15
      })
    });
    assert.equal(createItem.status, 201);
    const createdItem = await createItem.json();
    assert.equal(createdItem.price, 12500);
    assert.deepEqual(createdItem.extras, [{ name: 'Extra cheese', price: 1000 }]);

    const updateItem = await fetch(`${base}/api/admin/menu/${createdItem.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Updated special',
        category: 'Specials',
        price: 13000,
        desc: 'Updated test menu item',
        image: '',
        extras: [{ name: 'Extra cheese', price: 1000 }]
      })
    });
    assert.equal(updateItem.status, 200);
    assert.equal((await updateItem.json()).name, 'Updated special');

    const invalidImage = await fetch(`${base}/api/admin/menu`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Bad image', category: 'Test', price: 1000, desc: 'Test', image: 'javascript:alert(1)' })
    });
    assert.equal(invalidImage.status, 400);

    const unsignedCustomerData = await fetch(`${base}/api/customer/account`);
    assert.equal(unsignedCustomerData.status, 401);
    const registerCustomer = await fetch(`${base}/api/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Customer', phone: '555-0100', email: 'customer@example.test', password: 'customer password 123' })
    });
    assert.equal(registerCustomer.status, 201);
    const customerCookie = registerCustomer.headers.getSetCookie()[0].split(';')[0];
    assert.match(registerCustomer.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(registerCustomer.headers.get('set-cookie'), /SameSite=Strict/i);
    const customerHeaders = { Cookie: customerCookie, 'Content-Type': 'application/json' };
    assert.equal((await registerCustomer.json()).customer.email, 'customer@example.test');
    assert.equal((await (await fetch(`${base}/api/customer/session`, { headers: { Cookie: customerCookie } })).json()).authenticated, true);
    const invalidCustomerLogin = await fetch(`${base}/api/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' })
    });
    assert.equal(invalidCustomerLogin.status, 400);
    const wrongCustomerLogin = await fetch(`${base}/api/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@example.test', password: 'wrong password' })
    });
    assert.equal(wrongCustomerLogin.status, 401);
    const unknownCustomerLogin = await fetch(`${base}/api/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.test', password: 'customer password 123' })
    });
    assert.equal(unknownCustomerLogin.status, 401);
    const customerLogin = await fetch(`${base}/api/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ' CUSTOMER@example.test ', password: 'customer password 123' })
    });
    assert.equal(customerLogin.status, 200);
    const customerLoginCookie = customerLogin.headers.getSetCookie()[0].split(';')[0];
    assert.equal((await (await fetch(`${base}/api/customer/session`, { headers: { Cookie: customerLoginCookie } })).json()).authenticated, true);
    assert.equal((await fetch(`${base}/api/customer/logout`, { method: 'POST', headers: { Cookie: customerLoginCookie } })).status, 204);
    assert.equal((await (await fetch(`${base}/api/customer/session`)).json()).authenticated, false);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const rejectedLogin = await fetch(`${base}/api/customer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'customer@example.test', password: 'wrong password' })
      });
      assert.equal(rejectedLogin.status, 401);
    }
    const throttledCustomerLogin = await fetch(`${base}/api/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@example.test', password: 'customer password 123' })
    });
    assert.equal(throttledCustomerLogin.status, 429);
    const privateAccount = await fetch(`${base}/api/customer/account`, { headers: { Cookie: customerCookie } });
    assert.equal(privateAccount.status, 200);
    assert.equal('passwordHash' in await privateAccount.json(), false);
    const saveFavorites = await fetch(`${base}/api/customer/favorites`, {
      method: 'PUT',
      headers: customerHeaders,
      body: JSON.stringify({ ids: [seededMenu[0].id, seededMenu[1].id] })
    });
    assert.deepEqual((await saveFavorites.json()).favorites, [seededMenu[0].id, seededMenu[1].id]);
    const invalidFavorite = await fetch(`${base}/api/customer/favorites`, {
      method: 'PUT',
      headers: customerHeaders,
      body: JSON.stringify({ ids: [999999] })
    });
    assert.equal(invalidFavorite.status, 400);
    const duplicateCustomer = await fetch(`${base}/api/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Duplicate', phone: '555-0200', email: 'CUSTOMER@example.test', password: 'customer password 123' })
    });
    assert.equal(duplicateCustomer.status, 409);
    const guestOrderKey = crypto.randomUUID();
    const guestPickupResponse = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': guestOrderKey },
      body: JSON.stringify({ deliveryType: 'pickup', items: [{ id: seededMenu[0].id, quantity: 1 }] })
    });
    assert.equal(guestPickupResponse.status, 201);
    const guestPickup = await guestPickupResponse.json();
    assert.equal(guestPickup.order.customerId, null);
    assert.equal(guestPickup.order.source, 'online');
    assert.equal(guestPickup.order.orderType, 'pickup');
    assert.equal(guestPickup.order.address, null);
    assert.equal(typeof guestPickup.trackingToken, 'string');
    const invalidPickupTransition = await fetch(`${base}/api/admin/orders/${guestPickup.order.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'Delivered' })
    });
    assert.equal(invalidPickupTransition.status, 400, 'pickup orders cannot use delivery-only statuses');
    const duplicateGuestPickup = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': guestOrderKey },
      body: JSON.stringify({ deliveryType: 'pickup', items: [{ id: seededMenu[0].id, quantity: 1 }] })
    });
    assert.equal(duplicateGuestPickup.status, 409);
    const guestCannotPlaceDelivery = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ deliveryType: 'delivery', addressId: 'foreign', items: [{ id: seededMenu[0].id, quantity: 1 }] })
    });
    assert.equal(guestCannotPlaceDelivery.status, 401);

    const addHome = await fetch(`${base}/api/customer/addresses`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        label: 'Home', city: 'Erbil', street: 'Test Street', building: '10', unit: 'Floor 2',
        notes: 'Blue gate', latitude: 36.2, longitude: 44.0, mapAddress: 'Test home location'
      })
    });
    assert.equal(addHome.status, 201);
    const homeAddress = await addHome.json();
    assert.equal(homeAddress.isDefault, true);
    const addWork = await fetch(`${base}/api/customer/addresses`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        label: 'Work', city: 'Erbil', street: 'Office Street', building: '22', unit: 'Suite 5',
        notes: 'Reception desk', latitude: 36.21, longitude: 44.01, mapAddress: 'Test work location', isDefault: true
      })
    });
    assert.equal(addWork.status, 201);
    const workAddress = await addWork.json();
    assert.equal(workAddress.isDefault, true);
    const accountWithAddresses = await (await fetch(`${base}/api/customer/account`, { headers: { Cookie: customerCookie } })).json();
    assert.equal(accountWithAddresses.addresses.find(address => address.id === homeAddress.id).isDefault, false);
    assert.equal(accountWithAddresses.addresses.find(address => address.id === workAddress.id).isDefault, true);

    const otherRegister = await fetch(`${base}/api/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Other Customer', phone: '555-0200', email: 'other-customer@example.test', password: 'another password 456' })
    });
    const otherCustomerCookie = otherRegister.headers.getSetCookie()[0].split(';')[0];
    assert.deepEqual((await (await fetch(`${base}/api/customer/account`, { headers: { Cookie: otherCustomerCookie } })).json()).favorites, []);
    assert.equal((await (await fetch(`${base}/api/customer/orders`, { headers: { Cookie: otherCustomerCookie } })).json()).length, 0);
    const otherCannotReadAddress = await fetch(`${base}/api/customer/addresses/${homeAddress.id}/default`, {
      method: 'PATCH',
      headers: { Cookie: otherCustomerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(otherCannotReadAddress.status, 404);
    const setHomeDefault = await fetch(`${base}/api/customer/addresses/${homeAddress.id}/default`, {
      method: 'PATCH',
      headers: customerHeaders,
      body: JSON.stringify({})
    });
    assert.equal(setHomeDefault.status, 200);
    assert.equal((await setHomeDefault.json()).isDefault, true);
    const restoreWorkDefault = await fetch(`${base}/api/customer/addresses/${workAddress.id}/default`, {
      method: 'PATCH',
      headers: customerHeaders,
      body: JSON.stringify({})
    });
    assert.equal((await restoreWorkDefault.json()).isDefault, true);
    const ownProfileUpdate = await fetch(`${base}/api/customer/account`, {
      method: 'PUT',
      headers: customerHeaders,
      body: JSON.stringify({ name: 'Updated Test Customer', phone: '555-0101', email: 'customer@example.test' })
    });
    assert.equal(ownProfileUpdate.status, 200);

    const createCashier = await fetch(`${base}/api/admin/staff`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Test Cashier', email: 'cashier@example.test', password: 'cashier password 123', role: 'cashier' })
    });
    assert.equal(createCashier.status, 201);
    const cashier = await createCashier.json();
    const createDriver = await fetch(`${base}/api/admin/staff`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Test Driver', email: 'driver@example.test', password: 'driver password 1234', role: 'driver' })
    });
    assert.equal(createDriver.status, 201);
    const driver = await createDriver.json();
    const createOtherDriver = await fetch(`${base}/api/admin/staff`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Other Driver', email: 'driver2@example.test', password: 'driver two password 123', role: 'driver' })
    });
    assert.equal(createOtherDriver.status, 201);
    const otherDriver = await createOtherDriver.json();
    const cashierLogin = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cashier.email, password: 'cashier password 123' })
    });
    assert.equal(cashierLogin.status, 200);
    const cashierCookie = cashierLogin.headers.getSetCookie()[0].split(';')[0];
    const cashierHeaders = { Cookie: cashierCookie, 'Content-Type': 'application/json' };
    assert.equal((await fetch(`${base}/api/admin/staff`, { headers: { Cookie: cashierCookie } })).status, 401);
    assert.equal((await fetch(`${base}/api/driver/orders`, { headers: { Cookie: cashierCookie } })).status, 403);

    await fetch(`${base}/api/admin/delivery-settings`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ deliveryFee: 500, minimumOrder: 0, pickupEnabled: true, dineInEnabled: true, deliveryArea: null })
    });
    const createTable = async number => {
      const response = await fetch(`${base}/api/admin/tables`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ number })
      });
      assert.equal(response.status, 201);
      return response.json();
    };
    const onlineDineTable = await createTable('A1');
    const walkInDineTable = await createTable('A2');
    const reservedTable = await createTable('A3');
    const reserveTable = await fetch(`${base}/api/admin/tables/${reservedTable.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ number: 'A3', reserved: true })
    });
    assert.equal((await reserveTable.json()).status, 'Reserved');
    assert.deepEqual((await (await fetch(`${base}/api/dine-in/tables`)).json()).map(table => table.number), ['A1', 'A2']);
    assert.equal((await (await fetch(`${base}/api/staff/tables`, { headers: { Cookie: cashierCookie } })).json()).length, 3);

    const onlineDineKey = crypto.randomUUID();
    const onlineDineResponse = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': onlineDineKey },
      body: JSON.stringify({
        deliveryType: 'dine-in',
        tableId: onlineDineTable.id,
        payment: 'Cash at table',
        items: [{ id: seededMenu[1].id, quantity: 2 }]
      })
    });
    assert.equal(onlineDineResponse.status, 201);
    const onlineDineOrder = await onlineDineResponse.json();
    assert.equal(onlineDineOrder.order.customerId, null);
    assert.equal(onlineDineOrder.order.orderType, 'dine-in');
    assert.equal(onlineDineOrder.order.tableNumber, 'A1');
    assert.equal(onlineDineOrder.order.address, null);
    const confirmOnlineDine = await fetch(`${base}/api/staff/orders/${onlineDineOrder.order.id}/status`, {
      method: 'PATCH',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'Confirmed' })
    });
    assert.equal(confirmOnlineDine.status, 200);
    const occupiedTableConflict = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ deliveryType: 'dine-in', tableId: onlineDineTable.id, items: [{ id: seededMenu[0].id, quantity: 1 }] })
    });
    assert.equal(occupiedTableConflict.status, 400);

    const guestPickupConfirmed = await fetch(`${base}/api/staff/orders/${guestPickup.order.id}/status`, {
      method: 'PATCH',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'Confirmed' })
    });
    assert.equal(guestPickupConfirmed.status, 200);
    const walkInPickupResponse = await fetch(`${base}/api/staff/walk-in-orders`, {
      method: 'POST',
      headers: { ...cashierHeaders, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ deliveryType: 'pickup', customerName: 'Walk-in pickup', items: [{ id: seededMenu[2].id, quantity: 1 }] })
    });
    assert.equal(walkInPickupResponse.status, 201);
    const walkInPickup = await walkInPickupResponse.json();
    assert.equal(walkInPickup.order.source, 'walk-in');
    assert.equal(walkInPickup.order.status, 'Confirmed');
    assert.equal(walkInPickup.order.deliveryType, 'pickup');
    const walkInDineResponse = await fetch(`${base}/api/staff/walk-in-orders`, {
      method: 'POST',
      headers: { ...cashierHeaders, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        deliveryType: 'dine-in',
        tableId: walkInDineTable.id,
        customerName: 'Walk-in dine-in',
        items: [{ id: seededMenu[3].id, quantity: 2, instructions: 'Serve together' }]
      })
    });
    assert.equal(walkInDineResponse.status, 201);
    const walkInDine = await walkInDineResponse.json();
    assert.equal(walkInDine.order.tableNumber, 'A2');
    const occupiedDineTable = (await (await fetch(`${base}/api/staff/tables`, { headers: { Cookie: cashierCookie } })).json())
      .find(table => table.id === walkInDineTable.id);
    assert.equal(occupiedDineTable.status, 'Occupied');
    assert.equal((await fetch(`${base}/api/admin/tables/${walkInDineTable.id}`, { method: 'DELETE', headers: adminHeaders })).status, 409);

    const createKitchen = await fetch(`${base}/api/admin/staff`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Test Kitchen', email: 'kitchen@example.test', password: 'kitchen password 123', role: 'kitchen' })
    });
    assert.equal(createKitchen.status, 201);
    const kitchen = await createKitchen.json();
    const kitchenLogin = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: kitchen.email, password: 'kitchen password 123' })
    });
    assert.equal(kitchenLogin.status, 200);
    const kitchenCookie = kitchenLogin.headers.getSetCookie()[0].split(';')[0];
    const kitchenHeaders = { Cookie: kitchenCookie, 'Content-Type': 'application/json' };
    assert.equal((await (await fetch(`${base}/api/kitchen/orders`, { headers: { Cookie: kitchenCookie } })).json()).length, 4);
    assert.equal((await fetch(`${base}/api/admin/staff`, { headers: { Cookie: kitchenCookie } })).status, 401);
    assert.equal((await fetch(`${base}/api/kitchen/orders`, { headers: { Cookie: cashierCookie } })).status, 403);

    const kitchenSetStatus = async (orderId, status) => {
      const response = await fetch(`${base}/api/kitchen/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: kitchenHeaders,
        body: JSON.stringify({ status })
      });
      assert.equal(response.status, 200, `kitchen can set ${status}`);
      assert.equal((await response.json()).status, status);
    };
    for (const orderId of [guestPickup.order.id, onlineDineOrder.order.id, walkInPickup.order.id, walkInDine.order.id]) {
      await kitchenSetStatus(orderId, 'Preparing');
      await kitchenSetStatus(orderId, 'Ready');
    }
    for (const orderId of [guestPickup.order.id, walkInPickup.order.id]) {
      const collected = await fetch(`${base}/api/staff/orders/${orderId}/status`, {
        method: 'PATCH', headers: cashierHeaders, body: JSON.stringify({ status: 'Collected' })
      });
      assert.equal(collected.status, 200);
    }
    for (const orderId of [onlineDineOrder.order.id, walkInDine.order.id]) {
      const served = await fetch(`${base}/api/staff/orders/${orderId}/status`, {
        method: 'PATCH', headers: cashierHeaders, body: JSON.stringify({ status: 'Served' })
      });
      assert.equal(served.status, 200);
      const completed = await fetch(`${base}/api/staff/orders/${orderId}/status`, {
        method: 'PATCH', headers: cashierHeaders, body: JSON.stringify({ status: 'Completed' })
      });
      assert.equal(completed.status, 200);
    }
    assert.equal((await (await fetch(`${base}/api/staff/tables`, { headers: { Cookie: cashierCookie } })).json()).find(table => table.id === onlineDineTable.id).status, 'Available');

    const firstMenuItem = seededMenu[0];
    const checkoutItems = [
      { id: firstMenuItem.id, quantity: 2, price: 1 },
      { id: createdItem.id, quantity: 1, extras: ['Extra cheese'], instructions: 'No onions' }
    ];
    const quote = await fetch(`${base}/api/checkout/quote`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ deliveryType: 'delivery', addressId: workAddress.id, items: checkoutItems, deliveryFee: 1 })
    });
    assert.equal(quote.status, 200);
    assert.equal((await quote.json()).deliveryFee, 500);
    const pickupQuote = await fetch(`${base}/api/checkout/quote`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ deliveryType: 'pickup', items: checkoutItems })
    });
    assert.equal(pickupQuote.status, 200);
    assert.equal((await pickupQuote.json()).deliveryFee, 0);
    const configureArea = await fetch(`${base}/api/admin/delivery-settings`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ deliveryFee: 500, minimumOrder: 0, pickupEnabled: true, deliveryArea: { latitude: 36.2, longitude: 44, radiusKm: 1 } })
    });
    assert.equal(configureArea.status, 200);
    const outsideAreaQuote = await fetch(`${base}/api/checkout/quote`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ deliveryType: 'delivery', addressId: workAddress.id, items: checkoutItems })
    });
    assert.equal(outsideAreaQuote.status, 400);
    await fetch(`${base}/api/admin/delivery-settings`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ deliveryFee: 500, minimumOrder: 0, pickupEnabled: true, deliveryArea: null })
    });
    const checkoutKey = crypto.randomUUID();
    const createOrder = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { ...customerHeaders, 'Idempotency-Key': checkoutKey },
      body: JSON.stringify({
        deliveryType: 'delivery',
        addressId: workAddress.id,
        payment: 'Cash on delivery',
        deliveryFee: 1,
        total: 2,
        items: checkoutItems
      })
    });
    assert.equal(createOrder.status, 201);
    const orderResult = await createOrder.json();
    assert.equal(orderResult.order.payment, 'Cash on delivery');
    assert.equal(orderResult.order.total, firstMenuItem.price * 2 + 14500);
    assert.equal(orderResult.order.subtotal, firstMenuItem.price * 2 + 14000);
    assert.equal(orderResult.order.deliveryFee, 500);
    assert.equal(orderResult.order.customer.name, 'Updated Test Customer');
    assert.equal(orderResult.order.address.id, workAddress.id);
    assert.equal(orderResult.order.address.latitude, workAddress.latitude);
    assert.equal(orderResult.paymentConfirmed, false);
    assert.equal(orderResult.order.items[0].price, firstMenuItem.price);
    assert.deepEqual(orderResult.order.items[1].extras, [{ name: 'Extra cheese', price: 1000 }]);
    assert.equal(orderResult.order.items[1].instructions, 'No onions');
    assert.equal(typeof orderResult.trackingToken, 'string');
    assert.ok(orderResult.trackingToken.length >= 32);
    assert.equal('trackingTokenHash' in orderResult.order, false);
    const duplicateOrder = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { ...customerHeaders, 'Idempotency-Key': checkoutKey },
      body: JSON.stringify({ deliveryType: 'delivery', addressId: workAddress.id, items: checkoutItems })
    });
    assert.equal(duplicateOrder.status, 409);
    assert.equal((await fetch(`${base}/api/admin/orders`, { headers: { Cookie: cookie } })).status, 200);
    const cashierOrders = await fetch(`${base}/api/staff/orders`, { headers: { Cookie: cashierCookie } });
    assert.equal(cashierOrders.status, 200);
    assert.equal((await cashierOrders.json())[0].id, orderResult.order.id);
    assert.equal((await fetch(`${base}/api/admin/orders`, { headers: { Cookie: cashierCookie } })).status, 401);
    const cashierStatus = await fetch(`${base}/api/staff/orders/${orderResult.order.id}/status`, {
      method: 'PATCH',
      headers: cashierHeaders,
      body: JSON.stringify({ status: 'Confirmed' })
    });
    assert.equal(cashierStatus.status, 200);
    const cashierPayment = await fetch(`${base}/api/staff/orders/${orderResult.order.id}/payment`, {
      method: 'PATCH',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentStatus: 'Paid' })
    });
    assert.equal(cashierPayment.status, 200);
    assert.equal((await cashierPayment.json()).paymentStatus, 'Paid');
    const duplicatePaymentConfirmation = await fetch(`${base}/api/staff/orders/${orderResult.order.id}/payment`, {
      method: 'PATCH',
      headers: cashierHeaders,
      body: JSON.stringify({ paymentStatus: 'Paid' })
    });
    assert.equal(duplicatePaymentConfirmation.status, 400);
    assert.equal((await (await fetch(`${base}/api/staff/delivery-map`, { headers: { Cookie: cashierCookie } })).json()).length, 1);
    assert.equal((await fetch(`${base}/api/staff/delivery-map`, { headers: { Cookie: otherCustomerCookie } })).status, 401);

    const privateOrderWithoutToken = await fetch(`${base}/api/orders/${orderResult.order.id}`);
    assert.equal(privateOrderWithoutToken.status, 404);
    const privateOrderWithWrongToken = await fetch(`${base}/api/orders/${orderResult.order.id}`, {
      headers: { 'X-Order-Token': 'not-the-order-token' }
    });
    assert.equal(privateOrderWithWrongToken.status, 404);
    const customerOrder = await fetch(`${base}/api/orders/${orderResult.order.id}`, {
      headers: { 'X-Order-Token': orderResult.trackingToken }
    });
    assert.equal(customerOrder.status, 200);
    assert.equal((await customerOrder.json()).status, 'Confirmed');
    const reviewBeforeDelivery = await fetch(`${base}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Order-Token': orderResult.trackingToken },
      body: JSON.stringify({ orderId: orderResult.order.id, rating: 5, comment: 'A verified test review.' })
    });
    assert.equal(reviewBeforeDelivery.status, 400);
    const reviewWithWrongToken = await fetch(`${base}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Order-Token': 'invalid-token' },
      body: JSON.stringify({ orderId: orderResult.order.id, rating: 5, comment: 'Invalid token.' })
    });
    assert.equal(reviewWithWrongToken.status, 404);

    const adminOrders = await fetch(`${base}/api/admin/orders`, { headers: { Cookie: cookie } });
    assert.equal(adminOrders.status, 200);
    assert.equal((await adminOrders.json())[0].customer.name, 'Updated Test Customer');
    const analyticsResponse = await fetch(`${base}/api/admin/analytics`, { headers: { Cookie: cookie } });
    assert.equal(analyticsResponse.status, 200);
    const analytics = await analyticsResponse.json();
    const allOrdersForAnalytics = await (await fetch(`${base}/api/admin/orders`, { headers: { Cookie: cookie } })).json();
    assert.equal(analytics.totalOrders, allOrdersForAnalytics.length);
    assert.equal(analytics.completedOrders, 4);
    assert.equal(analytics.totalOrderValue, allOrdersForAnalytics.reduce((sum, order) => sum + order.total, 0));
    assert.equal(analytics.collectedRevenue, 0, 'paid but not yet delivered orders are not completed revenue');
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(analytics.todayOrders, allOrdersForAnalytics.filter(order => order.createdAt.slice(0, 10) === today).length);
    assert.equal(analytics.todayRevenue, allOrdersForAnalytics
      .filter(order => order.createdAt.slice(0, 10) === today &&
        ['Delivered', 'Collected', 'Completed'].includes(order.status) && order.paymentStatus === 'Paid')
      .reduce((sum, order) => sum + order.total, 0));
    assert.equal(analytics.bestSellers.some(item => item.name === 'Test House Burger' && item.quantity === 1), true);

    const unavailableItem = await fetch(`${base}/api/admin/menu/${createdItem.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Updated special',
        category: 'Specials',
        price: 13000,
        desc: 'Updated test menu item',
        extras: [{ name: 'Extra cheese', price: 1000 }],
        available: false
      })
    });
    assert.equal((await unavailableItem.json()).available, false);
    const unavailableOrder = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { ...customerHeaders, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        deliveryType: 'delivery',
        addressId: workAddress.id,
        items: [{ id: createdItem.id, quantity: 1 }]
      })
    });
    assert.equal(unavailableOrder.status, 400);

    const updateAddress = await fetch(`${base}/api/customer/addresses/${workAddress.id}`, {
      method: 'PUT',
      headers: customerHeaders,
      body: JSON.stringify({
        label: 'Work', city: 'Erbil', street: 'Updated Office Street', building: '22', unit: 'Suite 5',
        notes: 'New reception desk', latitude: 36.22, longitude: 44.02, mapAddress: 'Updated work location', isDefault: true
      })
    });
    assert.equal(updateAddress.status, 200);
    const customerOrders = await fetch(`${base}/api/customer/orders`, { headers: { Cookie: customerCookie } });
    assert.equal(customerOrders.status, 200);
    const ownedOrder = (await customerOrders.json())[0];
    assert.equal(ownedOrder.address.street, 'Office Street', 'orders retain their original address snapshot');
    assert.equal(ownedOrder.address.latitude, workAddress.latitude);
    const deleteHome = await fetch(`${base}/api/customer/addresses/${homeAddress.id}`, {
      method: 'DELETE',
      headers: { Cookie: customerCookie }
    });
    assert.equal(deleteHome.status, 204);
    const addressesAfterDelete = (await (await fetch(`${base}/api/customer/account`, { headers: { Cookie: customerCookie } })).json()).addresses;
    assert.equal(addressesAfterDelete.length, 1);
    assert.equal(addressesAfterDelete[0].isDefault, true);
    const persistedCustomerOrder = await fetch(`${base}/api/orders/${orderResult.order.id}`, {
      headers: { 'X-Order-Token': orderResult.trackingToken }
    });
    assert.equal((await persistedCustomerOrder.json()).status, 'Confirmed');
    const unassignedOrders = await fetch(`${base}/api/driver/orders`, { headers: { Cookie: customerCookie } });
    assert.equal(unassignedOrders.status, 401);
    const driverLogin = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: driver.email, password: 'driver password 1234' })
    });
    assert.equal(driverLogin.status, 200);
    const driverCookie = driverLogin.headers.getSetCookie()[0].split(';')[0];
    const driverHeaders = { Cookie: driverCookie, 'Content-Type': 'application/json' };
    assert.deepEqual(await (await fetch(`${base}/api/driver/orders`, { headers: { Cookie: driverCookie } })).json(), []);
    const unauthorizedDriverUpdate = await fetch(`${base}/api/driver/orders/${orderResult.order.id}/status`, {
      method: 'PATCH',
      headers: driverHeaders,
      body: JSON.stringify({ status: 'Picked Up' })
    });
    assert.equal(unauthorizedDriverUpdate.status, 404);
    const prematureAssignment = await fetch(`${base}/api/admin/orders/${orderResult.order.id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ driverId: driver.id })
    });
    assert.equal(prematureAssignment.status, 409, 'drivers cannot be assigned before the delivery is Ready');
    await kitchenSetStatus(orderResult.order.id, 'Preparing');
    await kitchenSetStatus(orderResult.order.id, 'Ready');
    const assignOrder = await fetch(`${base}/api/admin/orders/${orderResult.order.id}/assign`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ driverId: driver.id })
    });
    assert.equal(assignOrder.status, 200);
    assert.equal((await assignOrder.json()).status, 'Assigned');
    const otherDriverLogin = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otherDriver.email, password: 'driver two password 123' })
    });
    const otherDriverCookie = otherDriverLogin.headers.getSetCookie()[0].split(';')[0];
    assert.deepEqual(await (await fetch(`${base}/api/driver/orders`, { headers: { Cookie: otherDriverCookie } })).json(), []);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const rejectedStaffLogin = await fetch(`${base}/api/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
        body: JSON.stringify({ email: cashier.email, password: 'wrong staff password' })
      });
      assert.equal(rejectedStaffLogin.status, 401);
    }
    const throttledStaffLogin = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
      body: JSON.stringify({ email: cashier.email, password: 'cashier password 123' })
    });
    assert.equal(throttledStaffLogin.status, 429);
    for (const status of ['Picked Up', 'Out for delivery', 'Delivered']) {
      const driverStatus = await fetch(`${base}/api/driver/orders/${orderResult.order.id}/status`, {
        method: 'PATCH',
        headers: driverHeaders,
        body: JSON.stringify({ status })
      });
      assert.equal(driverStatus.status, 200);
      assert.equal((await driverStatus.json()).status, status);
    }
    const updatedCustomerOrder = await fetch(`${base}/api/orders/${orderResult.order.id}`, {
      headers: { 'X-Order-Token': orderResult.trackingToken }
    });
    assert.equal((await updatedCustomerOrder.json()).status, 'Delivered');
    const deliveredOrder = await fetch(`${base}/api/orders/${orderResult.order.id}`, {
      headers: { 'X-Order-Token': orderResult.trackingToken }
    });
    const deliveredSummary = await deliveredOrder.json();
    assert.equal(deliveredSummary.rewardPoints, Math.floor(orderResult.order.total / 1000) * 2);
    const changedPolicy = await (await fetch(`${base}/api/admin/design`, { headers: { Cookie: cookie } })).json();
    changedPolicy.rewardsPointsPer1000 = 9;
    const saveChangedPolicy = await fetch(`${base}/api/admin/design`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(changedPolicy)
    });
    assert.equal(saveChangedPolicy.status, 200);
    const rewardAfterPolicyChange = await fetch(`${base}/api/orders/${orderResult.order.id}`, {
      headers: { 'X-Order-Token': orderResult.trackingToken }
    });
    assert.equal((await rewardAfterPolicyChange.json()).rewardPoints, deliveredSummary.rewardPoints, 'earned reward points do not change with later policy edits');
    const submitReview = await fetch(`${base}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Order-Token': orderResult.trackingToken },
      body: JSON.stringify({ orderId: orderResult.order.id, rating: 5, displayName: 'Test Guest', comment: 'A verified test review.' })
    });
    assert.equal(submitReview.status, 201);
    assert.equal((await (await fetch(`${base}/api/reviews`)).json()).length, 0, 'reviews stay private until approved');
    const storedReviews = await fetch(`${base}/api/admin/reviews`, { headers: { Cookie: cookie } });
    const review = (await storedReviews.json())[0];
    assert.equal(review.approved, false);
    const approveReview = await fetch(`${base}/api/admin/reviews/${review.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ approved: true })
    });
    assert.equal(approveReview.status, 200);
    assert.equal((await (await fetch(`${base}/api/reviews`)).json()).length, 1);
    const duplicateReview = await fetch(`${base}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Order-Token': orderResult.trackingToken },
      body: JSON.stringify({ orderId: orderResult.order.id, rating: 5, comment: 'Duplicate review.' })
    });
    assert.equal(duplicateReview.status, 409);

    const deleteItem = await fetch(`${base}/api/admin/menu/${createdItem.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(deleteItem.status, 204);
    const deletePromotion = await fetch(`${base}/api/admin/promotions/${promotion.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(deletePromotion.status, 204);
    const deleteFuturePromotion = await fetch(`${base}/api/admin/promotions/${futurePromotionResult.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(deleteFuturePromotion.status, 204);
    const publishedBeforeRestart = await (await fetch(`${base}/api/design`)).json();
    const savedRestartDraft = await fetch(`${base}/api/admin/design/draft`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        ...publishedBeforeRestart,
        localizedContent: {
          ...publishedBeforeRestart.localizedContent,
          en: { ...publishedBeforeRestart.localizedContent.en, heroTitle: 'Draft survives restart' }
        }
      })
    });
    assert.equal(savedRestartDraft.status, 200);
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const rejectedRegistration = await fetch(`${base}/api/customer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', phone: '', email: '', password: '' })
      });
      assert.equal(rejectedRegistration.status, 400);
    }
    const throttledRegistration = await fetch(`${base}/api/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Extra user', phone: '555-0101', email: 'extra@example.test', password: 'extra password 123' })
    });
    assert.equal(throttledRegistration.status, 429);
    await stopServer();

    base = await startServer();
    const persistedMenu = await (await fetch(`${base}/api/menu`)).json();
    assert.equal(persistedMenu.some(item => item.id === createdItem.id), false);
    const persistedDesign = await fetch(`${base}/api/design`);
    const persistedDesignData = await persistedDesign.json();
    assert.equal(persistedDesignData.restaurantName, 'Test Cafe');
    assert.equal(persistedDesignData.heroImage, replacementImage.url);
    assert.equal((await fetch(`${base}${replacementImage.url}`)).status, 200, 'uploaded media survives server restart');
    const persistedLogin = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse battery staple' })
    });
    const persistedCookies = persistedLogin.headers.getSetCookie();
    const persistedCookie = persistedCookies.find(value => value.startsWith('dar_admin_session=')).split(';')[0];
    const persistedStaffCookie = persistedCookies.find(value => value.startsWith('dar_staff_session=')).split(';')[0];
    assert.equal((await fetch(`${base}/api/customer/account`, { headers: { Cookie: customerCookie } })).status, 200);
    const persistedCustomerOrders = await fetch(`${base}/api/customer/orders`, { headers: { Cookie: customerCookie } });
    assert.equal((await persistedCustomerOrders.json())[0].address.street, 'Office Street');
    const persistedOrders = await fetch(`${base}/api/admin/orders`, { headers: { Cookie: persistedCookie } });
    assert.equal((await persistedOrders.json())[0].status, 'Delivered');
    assert.equal((await fetch(`${base}/api/staff/session`, { headers: { Cookie: persistedStaffCookie } })).status, 200);
    const persistedDraft = await fetch(`${base}/api/admin/design/draft`, { headers: { Cookie: persistedCookie } });
    assert.equal((await persistedDraft.json()).design.localizedContent.en.heroTitle, 'Draft survives restart');
    assert.equal((await (await fetch(`${base}/api/reviews`)).json()).length, 1, 'approved reviews persist');
    assert.equal((await (await fetch(`${base}/api/promotions`)).json()).length, 0, 'deleted promotions stay deleted');
    const logout = await fetch(`${base}/api/admin/logout`, { method: 'POST', headers: { Cookie: persistedCookie } });
    assert.equal(logout.status, 204);
    const afterLogout = await fetch(`${base}/api/admin/orders`, { headers: { Cookie: persistedCookie } });
    assert.equal(afterLogout.status, 401);
    const ownerStaffAfterLogout = await fetch(`${base}/api/staff/session`, { headers: { Cookie: persistedStaffCookie } });
    assert.equal(ownerStaffAfterLogout.status, 401);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const rejectedLogin = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.test', password: 'wrong password' })
      });
      assert.equal(rejectedLogin.status, 401);
    }
    const throttledLogin = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse battery staple' })
    });
    assert.equal(throttledLogin.status, 429);
  } finally {
    await stopServer();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('coupons apply server-side at quote and order time and admin actions are audited', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'new-burger-coupon-'));
  const dataFile = path.join(directory, 'store.json');
  writeTestStore(dataFile);
  const server = http.createServer(createApp({
    dataFile,
    adminEmail: 'admin@example.test',
    adminPassword: 'correct horse battery staple',
    sessionSecret: 'test-session-secret-that-is-long-enough'
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse battery staple' })
    });
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0])
      .find(value => value.startsWith('dar_admin_session='));
    assert.equal(login.status, 200);

    const now = Date.now();
    const couponInput = {
      code: 'welcome_20',
      discountType: 'percentage',
      amount: 20,
      minimumSubtotal: 5000,
      usageLimit: 1,
      perCustomerLimit: 1,
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      deliveryTypes: ['pickup'],
      active: true
    };
    const createCoupon = await fetch(`${base}/api/admin/coupons`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(couponInput)
    });
    assert.equal(createCoupon.status, 201);
    const coupon = await createCoupon.json();
    assert.equal(coupon.code, 'WELCOME_20');
    assert.equal((await fetch(`${base}/api/admin/coupons`)).status, 401);
    const auditResponse = await fetch(`${base}/api/admin/audit-logs`, { headers: { Cookie: cookie } });
    assert.equal(auditResponse.status, 200);
    assert.ok((await auditResponse.json()).some(entry => entry.action === 'coupon.created'));
    assert.equal((await fetch(`${base}/api/admin/audit-logs`)).status, 401);

    const items = [{ id: 1, quantity: 1, extras: [] }];
    const quote = await fetch(`${base}/api/checkout/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryType: 'pickup', items, couponCode: 'welcome_20' })
    });
    assert.equal(quote.status, 200);
    assert.deepEqual(await quote.json(), {
      subtotal: 8500,
      discount: 1700,
      couponCode: 'WELCOME_20',
      deliveryFee: 0,
      total: 6800,
      payment: 'Cash at pickup',
      paymentStatus: 'Pending'
    });
    const belowMinimumQuote = await fetch(`${base}/api/checkout/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryType: 'pickup', items: [{ id: 8, quantity: 1 }], couponCode: 'WELCOME_20' })
    });
    assert.equal(belowMinimumQuote.status, 400);
    assert.match((await belowMinimumQuote.json()).error, /minimum subtotal/i);

    const placeOrder = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({ deliveryType: 'pickup', items, couponCode: 'WELCOME_20' })
    });
    assert.equal(placeOrder.status, 201);
    const order = (await placeOrder.json()).order;
    assert.equal(order.subtotal, 8500);
    assert.equal(order.discount, 1700);
    assert.equal(order.total, 6800);
    assert.equal(order.couponCode, 'WELCOME_20');
    const filteredReport = await fetch(`${base}/api/admin/analytics?deliveryType=pickup&status=Pending%20approval&paymentStatus=Pending&productId=1`, {
      headers: { Cookie: cookie }
    });
    assert.equal(filteredReport.status, 200);
    const report = await filteredReport.json();
    assert.equal(report.totalOrders, 1);
    assert.equal(report.pendingOrders, 1);
    assert.equal(report.collectedRevenue, 0);
    const invalidReport = await fetch(`${base}/api/admin/analytics?deliveryType=teleport`, { headers: { Cookie: cookie } });
    assert.equal(invalidReport.status, 400);

    const usedCoupon = await fetch(`${base}/api/checkout/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryType: 'pickup', items, couponCode: 'WELCOME_20' })
    });
    assert.equal(usedCoupon.status, 400);
    assert.match((await usedCoupon.json()).error, /usage limit/i);
    const adminCoupons = await fetch(`${base}/api/admin/coupons`, { headers: { Cookie: cookie } });
    assert.equal((await adminCoupons.json())[0].usageCount, 1);
    const cancelOrder = await fetch(`${base}/api/admin/orders/${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled' })
    });
    assert.equal(cancelOrder.status, 200);
    const availableAgain = await fetch(`${base}/api/checkout/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryType: 'pickup', items, couponCode: 'WELCOME_20' })
    });
    assert.equal(availableAgain.status, 200);
    const couponCountAfterCancellation = await fetch(`${base}/api/admin/coupons`, { headers: { Cookie: cookie } });
    assert.equal((await couponCountAfterCancellation.json())[0].usageCount, 0);

    const persistedStore = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.equal(persistedStore.orders[0].couponId, coupon.id);
    assert.ok(persistedStore.auditLogs.some(entry => entry.action === 'coupon.created'));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('new stores do not publish sample products and legacy default themes migrate without losing store data', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'new-burger-defaults-'));
  const freshStoreFile = path.join(directory, 'fresh.json');
  const legacyStoreFile = path.join(directory, 'legacy.json');
  const legacyOrder = { id: 'OLD-ORDER', items: [{ name: 'Saved item', price: 4200, quantity: 1 }] };
  const legacyMenu = [{ ...TEST_MENU[0], name: 'Saved menu item' }];
  const legacyPalette = {
    backgroundColor: '#141312',
    secondaryBackground: '#1c1a18',
    accentColor: '#f28a24',
    goldColor: '#d6aa5b',
    textColor: '#f7f3ec',
    mutedColor: '#b9b1a7',
    cardColor: '#211f1c',
    borderColor: '#39342e'
  };

  try {
    createApp({ dataFile: freshStoreFile });
    const freshStore = JSON.parse(fs.readFileSync(freshStoreFile, 'utf8'));
    assert.deepEqual(freshStore.menu, []);
    assert.equal(freshStore.design.restaurantName, 'New Burger');
    assert.equal(freshStore.design.themePreset, 'new-burger-bright');
    assert.equal(freshStore.design.accentColor, '#c62832');
    assert.equal(freshStore.design.backgroundColor, '#fffaf4');

    fs.writeFileSync(legacyStoreFile, JSON.stringify({
      menu: legacyMenu,
      orders: [legacyOrder],
      design: {
        restaurantName: 'New Burger',
        logoText: 'NB',
        themePreset: 'premium-dark',
        backgroundStyle: 'pattern',
        heroOverlay: 48,
        ...legacyPalette,
        localizedContent: {
          en: {
            heroTitle: 'Good food. Good mood.',
            heroSubtitle: 'Made fresh, packed with care, and delivered to your door in Erbil.',
            heroButton: 'Order now',
            aboutStory: ''
          },
          ckb: { heroTitle: '', heroSubtitle: '', heroButton: '', aboutStory: '' },
          ar: { heroTitle: 'Custom Arabic title', heroSubtitle: '', heroButton: 'اطلب', aboutStory: '' }
        }
      }
    }));
    createApp({ dataFile: legacyStoreFile });
    const migratedStore = JSON.parse(fs.readFileSync(legacyStoreFile, 'utf8'));
    assert.deepEqual(migratedStore.menu, legacyMenu);
    assert.deepEqual(migratedStore.orders, [legacyOrder]);
    assert.equal(migratedStore.design.restaurantName, 'New Burger');
    assert.equal(migratedStore.design.logoText, 'NB');
    assert.equal(migratedStore.design.themePreset, 'new-burger-bright');
    assert.equal(migratedStore.design.backgroundColor, '#fffaf4');
    assert.equal(migratedStore.design.accentColor, '#c62832');
    assert.equal(migratedStore.design.backgroundStyle, 'plain');
    assert.equal(migratedStore.design.localizedContent.en.heroSubtitle, 'Freshly prepared favourites, made for sharing.');
    assert.equal(migratedStore.design.localizedContent.ckb.heroTitle, 'خواردنی باش، هەستی باش.');
    assert.equal(migratedStore.design.localizedContent.ar.heroTitle, 'Custom Arabic title');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
