const $ = selector => document.querySelector(selector);
const cartFeedbackTimers = new WeakMap();
const STATUSES = ['Pending approval', 'Confirmed', 'Preparing', 'Ready', 'Out for delivery', 'Delivered', 'Cancelled'];
const LANGUAGES = {
  en: { label: 'English', native: 'English', direction: 'ltr' },
  ckb: { label: 'Kurdish Sorani', native: 'کوردیی سۆرانی', direction: 'rtl' },
  ar: { label: 'Arabic', native: 'العربية', direction: 'rtl' }
};
const TRANSLATIONS = {
  ckb: {
    'Home': 'سەرەتا', 'Our Menu': 'لیستی خواردن', 'My Orders / Order Tracking': 'داواکارییەکانم / شوێنکەوتنی داواکاری',
    'Offers & Promotions': 'ئۆفەر و داشکاندنەکان', 'Favorites': 'دڵخوازەکان', 'Reviews & Feedback': 'هەڵسەنگاندن و بۆچوون',
    'Loyalty & Rewards': 'خاڵ و پاداشت', 'Contact Us': 'پەیوەندیمان پێوە بکە', 'My Orders': 'داواکارییەکانم',
    'Featured dishes': 'خواردنە تایبەتەکان', 'Browse a selection of dishes currently available to order.': 'هەندێک لە خواردنە بەردەستەکانی ئێستا ببینە.',
    'Explore the full menu →': 'هەموو مێنووەکە ببینە ←', 'Offers & promotions': 'ئۆفەر و داشکاندنەکان',
    'Only currently valid restaurant offers are shown here.': 'تەنها ئۆفەرە بەردەستەکانی چێشتخانە لێرە پیشان دەدرێن.',
    'No featured dishes are available right now.': 'لە ئێستادا هیچ خواردنی تایبەت بەردەست نییە.',
    'No active promotions right now.': 'لە ئێستادا هیچ ئۆفەرێکی بەردەست نییە.',
    'Loading the menu…': 'مێنوو بار دەکرێت…', 'Loading dishes…': 'خواردنەکان بار دەکرێن…',
    'Checking current offers…': 'ئۆفەرە بەردەستەکان دەبینرێن…',
    'No favourites saved yet. Use the heart on a dish to save it here.': 'هێشتا هیچ خواردنێکی دڵخوازت پاشەکەوت نەکردووە. دڵەکەی لای خواردنەکە داگرە.',
    'Your favourites': 'خواردنە دڵخوازەکانت', 'Add to favorites': 'زیادکردن بۆ دڵخوازەکان',
    'Remove from favorites': 'لابردن لە دڵخوازەکان', 'Add to cart': 'زیادکردن بۆ سەبەتە', 'Added!': 'زیادکرا!',
    'Customer reviews': 'هەڵسەنگاندنی کڕیاران', 'No approved reviews yet.': 'هێشتا هیچ هەڵسەنگاندنێک پەسەند نەکراوە.',
    'Share feedback for a delivered order': 'بۆچوونت لەسەر داواکاری گەیەنراو بنووسە',
    'Order number': 'ژمارەی داواکاری', 'Private tracking code': 'کۆدی تایبەتی شوێنکەوتن',
    'Rating': 'هەڵسەنگاندن', 'Your review': 'بۆچوونت', 'Submit review': 'ناردنی بۆچوون',
    'Rewards are not configured yet.': 'سیستەمی پاداشت هێشتا ڕێکنەخراوە.',
    'Track rewards from delivered orders saved on this device.': 'خاڵەکانت لە داواکارییە گەیەنراوەکانت لەسەر ئەم ئامێرە ببینە.',
    'Points earned': 'خاڵی بەدەستهاتوو', 'Reward threshold': 'ئاستی پاداشت',
    'Valid through': 'تاوەکو', 'Loading rewards…': 'پاداشت بار دەکرێت…',
    'Reviews are accepted only for delivered orders, verified by their private tracking code. Reviews appear publicly after restaurant approval.': 'هەڵسەنگاندن تەنها بۆ داواکاری گەیەنراو بە کۆدی تایبەتی پەسەند دەکرێت و دوای پەسەندکردنی چێشتخانە پیشان دەدرێت.',
    'Display name (optional)': 'ناوی پیشاندان (ئارەزوومەندانە)', 'Phone': 'تەلەفۆن', 'Email': 'ئیمەیڵ', 'Address': 'ناونیشان',
    'Sign in': 'چوونەژوورەوە', 'Create your customer account': 'هەژماری کڕیار دروست بکە', 'Sign in to your account': 'بچۆ ژوورەوە بۆ هەژمارەکەت',
    'Save your delivery addresses and see your order history securely.': 'ناونیشانی گەیاندنەکانت پاشەکەوت بکە و مێژووی داواکارییەکانت بە پارێزراوی ببینە.',
    'Full name': 'ناوی تەواو', 'Password': 'وشەی نهێنی', 'Confirm password': 'دووبارە وشەی نهێنی', 'Show': 'پیشاندان', 'Hide': 'شاردنەوە',
    'Create account': 'دروستکردنی هەژمار', 'Already have an account? Sign in': 'هەژمارت هەیە؟ بچۆ ژوورەوە',
    'New here? Create an account': 'تازەیت؟ هەژمارێک دروست بکە', 'Your account': 'هەژمارەکەت',
    'Sign out': 'چوونەدەرەوە', 'Save profile': 'پاشەکەوتکردنی زانیاری', 'Profile saved.': 'زانیارییەکان پاشەکەوت کران.',
    'My Addresses': 'ناونیشانەکانم', 'Add address': 'زیادکردنی ناونیشان', 'Add an address': 'ناونیشانێک زیاد بکە',
    'Edit address': 'دەستکاری ناونیشان', 'No saved addresses yet. Add one with a map pin to use it at checkout.': 'هێشتا ناونیشانت پاشەکەوت نەکردووە. بۆ بەکارهێنان لە پارەدان ناونیشانێک لەگەڵ نیشانەی نەخشە زیاد بکە.',
    'Default': 'بنەڕەتی', 'Make default': 'کردنی بە بنەڕەتی', 'Edit': 'دەستکاری', 'Delete': 'سڕینەوە',
    'Address label': 'ناونیشانی شوێن', 'City': 'شار', 'Street / area': 'شەقام / ناوچە', 'Building / house': 'بیناکە / خانوو',
    'Apartment / floor': 'شوقە / نهۆم', 'Delivery instructions': 'ڕێنمایی گەیاندن', 'Pinned location': 'شوێنی نیشانکراو',
    'Choose a map pin before saving this address.': 'پێش پاشەکەوتکردنی ناونیشانەکە نیشانەیەک لە نەخشە هەڵبژێرە.',
    'Choose location on map': 'هەڵبژاردنی شوێن لەسەر نەخشە', 'Make this my default address': 'ئەمە بکە بە ناونیشانی بنەڕەتیم',
    'Save address': 'پاشەکەوتکردنی ناونیشان', 'Choose delivery location': 'شوێنی گەیاندن هەڵبژێرە',
    'Map tiles and address searches use OpenStreetMap services. GPS is optional and runs only after you request it.': 'نەخشە و گەڕانی ناونیشان خزمەتگوزاری OpenStreetMap بەکاردەهێنن. GPS ئارەزوومەندانەیە و تەنها دوای داواکاری تۆ کار دەکات.',
    'Search an address or place': 'گەڕان بەدوای ناونیشان یان شوێن', 'Search': 'گەڕان', 'Use my location': 'بەکارهێنانی شوێنی من',
    'Tap the map to place the delivery pin.': 'لەسەر نەخشە پەنجە بنێ بۆ دانانی نیشانەی گەیاندن.',
    'Confirm map location': 'پشتڕاستکردنەوەی شوێنی نەخشە', 'Choose a map pin before saving this address.': 'پێش پاشەکەوتکردنی ناونیشانەکە نیشانەیەک لە نەخشە هەڵبژێرە.',
    'Enter at least 3 characters to search.': 'بۆ گەڕان لانیکەم ٣ پیت بنووسە.', 'Location is unavailable in this browser. Search or move the map pin instead.': 'شوێن لەم وێبگەڕەدا بەردەست نییە. بگەڕێ یان نیشانەکە لە نەخشە بجوڵێنە.',
    'Location permission was denied. Search for an address or move the pin manually.': 'ڕێگەپێدانی شوێن ڕەتکرایەوە. ناونیشان بگەڕێ یان نیشانەکە بە دەستی بجوڵێنە.',
    'Could not determine your location. Search for an address or move the pin manually.': 'نەتوانرا شوێنەکەت دیاری بکرێت. ناونیشان بگەڕێ یان نیشانەکە بە دەستی بجوڵێنە.',
    'Choose a location on the map before confirming.': 'پێش پشتڕاستکردنەوە شوێنێک لە نەخشە هەڵبژێرە.',
    'Checkout · Step 1 of 2': 'پارەدان · هەنگاوی ١ لە ٢', 'Checkout': 'پارەدان', 'Select Delivery or Pickup, then review the server-calculated total.': 'گەیاندن یان وەرگرتن هەڵبژێرە، پاشان کۆی گشتی ژمێردراوی سێرڤەر ببینە.',
    'Delivery option': 'شێوازی وەرگرتن', 'Delivery': 'گەیاندن', 'Pickup': 'وەرگرتن لە چێشتخانە',
    'Delivery address': 'ناونیشانی گەیاندن', 'Add a different address': 'زیادکردنی ناونیشانێکی تر',
    'Delivery fee': 'کرێی گەیاندن', 'Discount': 'داشکاندن', 'Final total': 'کۆی کۆتایی',
    'Coupon code': 'کۆدی داشکاندن', 'Apply': 'جێبەجێکردن', 'Coupon': 'کۆپۆن', 'applied': 'جێبەجێ کرا', 'off': 'داشکاندن',
    'Payment method': 'شێوازی پارەدان', 'Cash Payment Only': 'تەنها پارەی کاش', 'Cash on Delivery': 'پارەی کاش لە کاتی گەیاندن',
    'Cash at Store (Takeaway)': 'پارەی کاش لە چێشتخانە (وەرگرتن)', 'Cash payments only. All orders are strictly for delivery or takeaway — no dine-in available.': 'تەنها پارەی کاش. هەموو داواکارییەکان تەنها بۆ گەیاندن یان وەرگرتنن — دانیشتن لە چێشتخانە بەردەست نییە.',
    'Takeout & Delivery Only: All orders are prepared for takeaway or delivery. Dine-in is not available.': 'تەنها وەرگرتنی خواردن و گەیاندن: هەموو داواکارییەکان بۆ وەرگرتن یان گەیاندن ئامادە دەکرێن. دانیشتن لە چێشتخانە بەردەست نییە.',
    'Review and place order': 'پێداچوونەوە و ناردنی داواکاری', 'Your order is created only when you tap Place Order. This website does not process card payments.': 'داواکارییەکەت تەنها کاتێک دروست دەبێت کە دوگمەی ناردنی داواکاری دابگرێت. ئەم ماڵپەڕە پارەدانی کارتی ئەنجام نادات.',
    'Payment has not been confirmed.': 'پارەدان هێشتا پشتڕاست نەکراوەتەوە.', 'Map pin not saved': 'نیشانەی نەخشە پاشەکەوت نەکراوە',
    'No orders have been placed from this account yet.': 'هێشتا هیچ داواکارییەک لەم هەژمارەوە نەکراوە.',
    'Rewards are tracked here. Ask restaurant staff how configured rewards can be redeemed.': 'خاڵەکانت لێرە تۆمار دەکرێن. لە کارمەندانی چێشتخانە بپرسە چۆن دەتوانیت بەکاریان بهێنیت.',
    'Restaurant contact details have not been configured yet.': 'زانیاری پەیوەندی چێشتخانە هێشتا دانەنراوە.',
    'Restaurant story has not been added yet.': 'چیرۆکی چێشتخانە هێشتا زیاد نەکراوە.',
    'About': 'دەربارەی', 'serves freshly prepared food in Erbil. Browse the menu, place an order, and follow its status securely from this device.': 'لە هەولێر خواردنی تازە ئامادەکراو پێشکەش دەکات. پێڕست ببینە، داواکاری تۆمار بکە و بە شێوەیەکی پارێزراو شوێنی بکەوە.',
    'Settings': 'ڕێکخستنەکان', 'Language': 'زمان', 'About Us': 'دەربارەی ئێمە', 'Close menu': 'داخستنی پێڕست',
    'Open menu': 'کردنەوەی پێڕست', 'New Burger home': 'سەرەتای New Burger',
    'Customer menu': 'پێڕستی کڕیار', 'Menu': 'پێڕست', 'Cart': 'سەبەتە', 'item': 'دانە', 'items': 'دانە', 'View Cart': 'بینینی سەبەتە', 'Customize': 'دەستکاریکردن', 'Add one': 'یەک دانە زیاد بکە', 'Remove one': 'یەک دانە کەم بکەوە', 'All': 'هەموو', 'Search dishes…': 'گەڕان بەدوای خواردن…',
    'Search menu': 'گەڕان لە پێڕستی خواردن', 'Sort': 'ڕیزکردن', 'Featured': 'هەڵبژێردراو', 'Price: low to high': 'نرخ: لە کەمەوە بۆ زۆر',
    'Price: high to low': 'نرخ: لە زۆرەوە بۆ کەم', 'Name': 'ناو', 'Max price': 'زۆرترین نرخ', 'Any price': 'هەر نرخێک',
    'WHAT SOUNDS GOOD?': 'کامەیان دڵت دەوێت؟', 'Explore the menu': 'پێڕستی خواردن ببینە', 'Choose a favourite. We’ll take care of the rest.': 'خواردنی دڵخوازت هەڵبژێرە، ئێمە بەشەکەی دیکە جێبەجێ دەکەین.',
    'FRESHLY MADE · DELIVERED TO YOU': 'تازە ئامادەکراو · بۆ تۆ دەگەیەنرێت', 'Good food.': 'خواردنی خۆش.', 'Good mood.': 'کەیفی خۆش.',
    'Freshly prepared favourites, made for sharing.': 'خواردنە دڵخوازەکانت بە تازەیی بۆ هاوبەشکردن ئامادە دەکەین.',
    'Made fresh, packed with care, and delivered to your door in Erbil.': 'لە هەولێر خواردنی تازە بە وریایی ئامادە دەکەین و بۆ دەرگاکەت دەیگەیەنین.',
    'Freshly prepared gourmet burger': 'بەرگری گۆرمەی تازە ئامادەکراو',
    'MADE FRESH TO ORDER': 'بەپێی داواکاری تازە ئامادە دەکرێت',
    'Order now': 'ئێستا داوا بکە', 'How ordering works →': 'چۆنیەتی داواکردن ←', 'Made with care': 'بە وریایی ئامادەکراوە',
    'Fresh food, every order': 'خواردنی تازە لە هەر داواکارییەکدا', 'Freshly prepared': 'تازە ئامادەکراوە', 'Made when you order': 'کاتێک داوا دەکەیت ئامادە دەکرێت',
    'Easy delivery': 'گەیاندنی ئاسان', 'Tell us where you are': 'شوێنەکەت پێمان بڵێ', 'Made for you': 'بۆ تۆ ئامادەکراوە',
    'Notes and extras welcome': 'تێبینی و زیادکراوەکان بەخێرهاتن', 'THREE EASY STEPS': 'سێ هەنگاوی ئاسان',
    'Your next favourite meal is close.': 'خواردنی داهاتووی دڵخوازت نزیکە.', 'Choose your food': 'خواردنەکەت هەڵبژێرە',
    'Explore the menu and add your favourites to the basket.': 'پێڕست ببینە و خواردنی دڵخوازت بخەرە ناو سەبەتەکەت.',
    'Tell us where': 'شوێنەکەت پێمان بڵێ', 'Enter your street, building and delivery instructions.': 'ناونیشان و ڕێنمایی گەیاندن بنووسە.',
    'Follow your order': 'شوێنکەوتنی داواکارییەکەت بکە', 'See each update from confirmation to delivery.': 'هەموو نوێکارییەک لە پشتڕاستکردنەوە تا گەیاندن ببینە.',
    'NEED TO KNOW?': 'زانیاریی گرنگ', 'Frequently asked questions': 'پرسیارە باوەکان', 'How do I place an order?': 'چۆن داواکارییەک تۆمار بکەم؟',
    'Choose dishes, add them to your cart, enter your contact and delivery details, then submit the order.': 'خواردن هەڵبژێرە، بیخەرە ناو سەبەتە، زانیاری پەیوەندی و گەیاندن بنووسە و داواکارییەکە بنێرە.',
    'Can I pay cash on delivery?': 'دەتوانم کاتی گەیاندن پارە بدەم؟',
    'Cash on delivery is available. Card and online payment processing are not configured.': 'پارەدان لە کاتی گەیاندن بەردەستە. پارەدانی کارتی و ئۆنلاین ڕێکنەخراوە.',
    'How do I track my order?': 'چۆن شوێنی داواکارییەکەم بزانم؟',
    'Open “My Orders / Order Tracking” on this device to securely view orders placed here and their latest status.': 'لەسەر ئەم ئامێرە «داواکارییەکانم / شوێنکەوتنی داواکاری» بکەرەوە بۆ بینینی پارێزراوی داواکارییەکانت و دۆخی نوێیان.',
    'Can I add delivery instructions?': 'دەتوانم ڕێنمایی گەیاندن زیاد بکەم؟', 'Yes. Add your street, building, floor or apartment, and any useful notes at checkout.': 'بەڵێ. لە کاتی تەواوکردنی داواکاری ناونیشان و هەر تێبینییەکی بەسوود زیاد بکە.',
    'Nearby landmark, work address, gate colour…': 'نیشانەی نزیک، ناونیشانی کار، ڕەنگی دەروازە…',
    'Paste a map link if you have one': 'ئەگەر هەتە بەستەری نەخشە دابنێ',
    'A live interactive map is not configured.': 'نەخشەی زیندوو ڕێکنەخراوە.',
    '07xx xxx xxxx': '٠٧xx xxx xxxx',
    'The request could not be completed.': 'نەتوانرا داواکارییەکە تەواو بکرێت.',
    'Made fresh to order': 'بەپێی داواکاری تازە ئامادە دەکرێت',
    'Restaurant admin': 'بەڕێوەبردنی چێشتخانە',     'Fresh food, made with care.': 'خواردنی تازە، بە وریایی ئامادەکراوە.', 'RESTAURANT': 'چێشتخانە',
    'Customize': 'بەپێی دڵخوازت', 'Out of stock': 'بەردەست نییە', 'No dishes found. Try another search.': 'هیچ خواردنێک نەدۆزرایەوە. وشەیەکی دیکە بگەڕێ.',
    'Ingredients:': 'پێکهاتەکان:', 'Estimated preparation:': 'کاتی چاوەڕوانی ئامادەکردن:', 'minutes': 'خولەک',
    'This item is currently unavailable.': 'ئەم بەرهەمە لە ئێستادا بەردەست نییە.', 'Optional extras': 'زیادکراوەی ئارەزوومەندانە',
    'Special instructions': 'ڕێنمایی تایبەت', 'Any preferences for this dish?': 'هیچ داواکارییەکی تایبەتت هەیە؟',
    'From': 'لە', 'Add to cart': 'زیادی بکە بۆ سەبەتە', 'Maximum quantity per dish is 99.': 'زۆرترین بڕ بۆ هەر خواردنێک ٩٩ دانەیە.',
    'Added to your cart': 'زیادکرا بۆ سەبەتەکەت', 'each': 'بۆ هەر دانەیەک', 'Extras:': 'زیادکراوەکان:',
    'Note:': 'تێبینی:', 'Total:': 'کۆی گشتی:', 'Delivery to:': 'گەیاندن بۆ:', 'Status:': 'دۆخ:',
    'Order received!': 'داواکاری وەرگیرا!',
    'Your cart': 'سەبەتەکەت', 'A few good things are on their way.': 'چەند خواردنێکی خۆش لە ڕێگادان.',
    'Remove one': 'یەک دانە لاببە', 'Add one': 'یەک دانە زیاد بکە', 'Your cart is empty. Add something delicious from the menu.': 'سەبەتەکەت بەتاڵە. خواردنێکی خۆش لە پێڕستەکە زیاد بکە.',
    'Subtotal': 'کۆی بەشەکان', 'Delivery fee, if any, will be confirmed by the restaurant.': 'کرێی گەیاندن ئەگەر هەبێت لەلایەن چێشتخانەوە پشتڕاست دەکرێتەوە.',
    'Continue to delivery details →': 'بەردەوام بە بۆ زانیاریی گەیاندن ←', 'Delivery details': 'زانیاریی گەیاندن',
    'Please tell us how to find you. Fields marked * are required.': 'تکایە چۆنیەتی دۆزینەوەت بۆ بنووسە. خانەکانی نیشانەکراو بە * پێویستن.',
    'Full name *': 'ناوی تەواو *', 'Your name': 'ناوت', 'Phone number *': 'ژمارەی تەلەفۆن *', 'City *': 'شار *',
    'Street / area *': 'شەقام / ناوچە *', 'Street or neighbourhood': 'شەقام یان گەڕەک', 'House / building number *': 'ژمارەی خانوو / بینا *',
    'Building number': 'ژمارەی بینا', 'Apartment / floor': 'شوقە / نهۆم', 'Delivery notes': 'تێبینیی گەیاندن',
    'Map link (optional)': 'بەستەری نەخشە (ئارەزوومەندانە)', 'Payment method *': 'شێوازی پارەدان *',
    'Nearby landmark, work address, gate colour…': 'نیشانەی نزیک، ناونیشانی کار، ڕەنگی دەروازە…',
    'Paste a map link if you have one': 'ئەگەر هەتە بەستەری نەخشە دابنێ',
    'A live interactive map is not configured.': 'نەخشەی زیندوو ڕێکنەخراوە.',
    '07xx xxx xxxx': '٠٧xx xxx xxxx', 'Erbil': 'هەولێر',
    'The request could not be completed.': 'نەتوانرا داواکارییەکە تەواو بکرێت.',
    'Cash on delivery': 'پارەدان لە کاتی گەیاندن', 'Order total': 'کۆی داواکاری', 'Your order will be sent to the restaurant for confirmation.': 'داواکارییەکەت بۆ پشتڕاستکردنەوە دەنێردرێت بۆ چێشتخانە.',
    'Place order': 'داواکاری تۆمار بکە', 'The restaurant has received your order.': 'چێشتخانە داواکارییەکەت وەرگرت.',
    'My orders': 'داواکارییەکانم', 'View my orders': 'داواکارییەکانم ببینە', 'Loading your order history…': 'مێژووی داواکارییەکانت بار دەکرێت…',
    'Order status is refreshed from the restaurant.': 'دۆخی داواکاری لە چێشتخانەوە نوێ دەکرێتەوە.',
    'No orders yet. Your first favourite is waiting in the menu.': 'هێشتا داواکارییەکت نییە. خواردنی دڵخوازت لە پێڕستەکە چاوەڕێتە.',
    'Track an order securely': 'بە شێوەیەکی پارێزراو شوێنکەوتنی داواکاری بکە',
    'Enter the order number and private tracking code from your confirmation.': 'ژمارەی داواکاری و کۆدی تایبەتی شوێنکەوتن لە پشتڕاستکردنەوەکەت بنووسە.',
    'Order Received': 'داواکاری وەرگیرا', 'Out for Delivery': 'لە ڕێگای گەیاندندایە', 'Ready for Takeaway': 'ئامادەیە بۆ وەرگرتن',
    'Order again': 'دووبارە داوا بکە', 'This order was cancelled.': 'ئەم داواکارییە هەڵوەشێنرایەوە.',
    'item added to your cart.': 'دانە زیاد کرا بۆ سەبەتەکەت.', 'items added to your cart.': 'دانە زیاد کران بۆ سەبەتەکەت.',
    'Some items or options are no longer available.': 'هەندێک خواردن یان هەڵبژاردە بەردەست نییە.',
    'No available items from this order could be added.': 'هیچ خواردنێکی بەردەست لەم داواکارییەوە زیاد نەکرا.',
    'Order number': 'ژمارەی داواکاری', 'Order number:': 'ژمارەی داواکاری:', 'Private tracking code': 'کۆدی تایبەتی شوێنکەوتن', 'Find order': 'دۆزینەوەی داواکاری',
    'Save this private tracking code to check your order on another device. Keep it private.': 'ئەم کۆدە تایبەتییە بۆ شوێنکەوتنی داواکاری لە ئامێرێکی تر پاشەکەوت بکە و بە نهێنی بیپارێزە.',
    'About New Burger': 'دەربارەی New Burger',
    'Our approach': 'شێوازی کارمان', 'We focus on fresh food, careful preparation, and making it straightforward to order and follow your delivery.': 'گرنگی بە خواردنی تازە، ئامادەکردنی بە وریایی و ئاسانکردنی داوا و شوێنکەوتنی گەیاندن دەدەین.',
    'Choose your language': 'زمانەکەت هەڵبژێرە', 'Language changes apply across the customer website.': 'گۆڕینی زمان لە هەموو ماڵپەڕی کڕیاردا جێبەجێ دەبێت.',
    'English': 'ئینگلیزی', 'Kurdish Sorani': 'کوردیی سۆرانی', 'Arabic': 'عەرەبی',
    'Pending approval': 'چاوەڕێی پشتڕاستکردنەوە', 'Confirmed': 'پشتڕاستکراوەتەوە', 'Preparing': 'ئامادە دەکرێت',
    'Ready': 'ئامادەیە', 'Out for delivery': 'لە ڕێگای گەیاندندایە', 'Delivered': 'گەیەنراوە', 'Cancelled': 'هەڵوەشێنراوەتەوە',
    'Website design could not be loaded: ': 'نەتوانرا دیزاینی ماڵپەڕ بار بکرێت: ',
    'The restaurant menu has been updated.': 'پێڕستی چێشتخانە نوێ کرایەوە.',
    'Restaurant': 'چێشتخانە', 'Order not found.': 'داواکاری نەدۆزرایەوە.',
    'A little something special.': 'شتێکی تایبەتی بچووک.',
    'Dar Signature Burger': 'بەرگری تایبەتی دار', 'Crispy Chicken Burger': 'بەرگری مریشکی کرسپ',
    'Garden Fresh Salad': 'سالادی سەوزەی باخی تازە', 'Loaded Fries': 'سیبە زەوی پڕکراوەکان',
    'Chicken Wrap': 'ڕاپی مریشک', 'Margherita Pizza': 'پیتزای مارگاریتا',
    'Chocolate Brownie': 'براونیی چۆکڵات', 'Fresh Lemon Mint': 'لیمۆ و پۆونەی تازە', 'Iced Coffee': 'قاوەی سارد',
    'Burgers': 'بەرگر', 'Salads': 'سالاد', 'Sides': 'پاڵاوتەکان', 'Wraps': 'ڕاپ',
    'Pizza': 'پیتزا', 'Desserts': 'شیرینی', 'Drinks': 'خواردنەوە',
    'Juicy grilled beef, house sauce, lettuce and tomato.': 'گۆشتی مانگای برژاو و سۆسی تایبەت و کاهو و تەماتە.',
    'Crispy chicken, fresh greens and creamy sauce.': 'مریشکی کرسپ و سەوزەی تازە و سۆسی کرێمی.',
    'Crunchy greens, cucumber, tomato and lemon dressing.': 'سەوزەی ترد و خیار و تەماتە و سۆسی لیمۆ.',
    'Golden fries with herbs and our signature seasoning.': 'سیبەزەوی زەڵاڵ بە گیا و تامدەرکەری تایبەت.',
    'Grilled chicken, crunchy vegetables and garlic sauce.': 'مریشکی برژاو و سەوزەی ترد و سۆسی سیر.',
    'Tomato, mozzarella and fragrant basil.': 'تەماتە و مۆزاریلا و ڕەیحانی بۆنخۆش.',
    'Rich chocolate brownie, soft in the middle.': 'براونیی چۆکڵاتی دەوڵەمەند، نەرم لە ناوەڕاستدا.',
    'Refreshing lemon, mint and chilled water.': 'لیمۆی تازەکەرەوە و پۆونە و ئاوی سارد.',
    'Smooth coffee served over ice.': 'قاوەی نەرم کە لەسەر بەفر پێشکەش دەکرێت.',
    'BESTSELLER': 'فرۆشی زۆر', 'CRISPY': 'کرێسپ', 'FRESH': 'تازە', 'POPULAR': 'بەناوبانگ',
    'FAVOURITE': 'دڵخواز', 'CLASSIC': 'کلاسیک', 'SWEET': 'شیرین', 'REFRESHING': 'تازەکەرەوە', 'CHILLED': 'سارد',
    'Order Online': 'داواکاری ئۆنلاین', 'Language updated.': 'زمان نوێ کرایەوە.'
  },
  ar: {
    'Home': 'الرئيسية', 'Our Menu': 'قائمتنا', 'My Orders / Order Tracking': 'طلباتي / تتبع الطلب',
    'Offers & Promotions': 'العروض والتخفيضات', 'Favorites': 'المفضلة', 'Reviews & Feedback': 'التقييمات والآراء',
    'Loyalty & Rewards': 'الولاء والمكافآت', 'Contact Us': 'اتصل بنا', 'My Orders': 'طلباتي',
    'Featured dishes': 'أطباق مميزة', 'Browse a selection of dishes currently available to order.': 'تصفح مجموعة من الأطباق المتاحة للطلب حالياً.',
    'Explore the full menu →': 'استكشف القائمة كاملة ←', 'Offers & promotions': 'العروض والتخفيضات',
    'Only currently valid restaurant offers are shown here.': 'تظهر هنا العروض السارية حالياً فقط.',
    'No featured dishes are available right now.': 'لا توجد أطباق مميزة متاحة حالياً.',
    'No active promotions right now.': 'لا توجد عروض سارية حالياً.',
    'Loading the menu…': 'جارٍ تحميل القائمة…', 'Loading dishes…': 'جارٍ تحميل الأطباق…',
    'Checking current offers…': 'جارٍ التحقق من العروض الحالية…',
    'No favourites saved yet. Use the heart on a dish to save it here.': 'لم تحفظ أطباقاً مفضلة بعد. اضغط على القلب بجانب الطبق لحفظه هنا.',
    'Your favourites': 'أطباقك المفضلة', 'Add to favorites': 'أضف إلى المفضلة',
    'Remove from favorites': 'أزل من المفضلة', 'Add to cart': 'أضف إلى السلة', 'Added!': 'تمت الإضافة!',
    'Customer reviews': 'تقييمات العملاء', 'No approved reviews yet.': 'لا توجد تقييمات معتمدة بعد.',
    'Share feedback for a delivered order': 'شارك رأيك حول طلب تم توصيله',
    'Order number': 'رقم الطلب', 'Private tracking code': 'رمز التتبع الخاص',
    'Rating': 'التقييم', 'Your review': 'رأيك', 'Submit review': 'إرسال التقييم',
    'Rewards are not configured yet.': 'لم يتم إعداد برنامج المكافآت بعد.',
    'Track rewards from delivered orders saved on this device.': 'تابع النقاط من الطلبات التي تم توصيلها والمحفوظة على هذا الجهاز.',
    'Points earned': 'النقاط المكتسبة', 'Reward threshold': 'حد المكافأة',
    'Valid through': 'ساري حتى', 'Loading rewards…': 'جارٍ تحميل المكافآت…',
    'Reviews are accepted only for delivered orders, verified by their private tracking code. Reviews appear publicly after restaurant approval.': 'تُقبل التقييمات للطلبات التي تم توصيلها فقط بعد التحقق من رمز التتبع الخاص، وتُنشر بعد موافقة المطعم.',
    'Display name (optional)': 'اسم العرض (اختياري)', 'Phone': 'الهاتف', 'Email': 'البريد الإلكتروني', 'Address': 'العنوان',
    'Sign in': 'تسجيل الدخول', 'Create your customer account': 'إنشاء حساب عميل', 'Sign in to your account': 'تسجيل الدخول إلى حسابك',
    'Save your delivery addresses and see your order history securely.': 'احفظ عناوين التوصيل واطّلع على سجل طلباتك بأمان.',
    'Full name': 'الاسم الكامل', 'Password': 'كلمة المرور', 'Confirm password': 'تأكيد كلمة المرور', 'Show': 'إظهار', 'Hide': 'إخفاء',
    'Create account': 'إنشاء الحساب', 'Already have an account? Sign in': 'لديك حساب؟ سجّل الدخول',
    'New here? Create an account': 'جديد هنا؟ أنشئ حساباً', 'Your account': 'حسابك',
    'Sign out': 'تسجيل الخروج', 'Save profile': 'حفظ الملف الشخصي', 'Profile saved.': 'تم حفظ الملف الشخصي.',
    'My Addresses': 'عناويني', 'Add address': 'إضافة عنوان', 'Add an address': 'إضافة عنوان',
    'Edit address': 'تعديل العنوان', 'No saved addresses yet. Add one with a map pin to use it at checkout.': 'لا توجد عناوين محفوظة. أضف عنواناً مع دبوس على الخريطة لاستخدامه عند الدفع.',
    'Default': 'افتراضي', 'Make default': 'تعيين كافتراضي', 'Edit': 'تعديل', 'Delete': 'حذف',
    'Address label': 'تسمية العنوان', 'City': 'المدينة', 'Street / area': 'الشارع / المنطقة', 'Building / house': 'المبنى / المنزل',
    'Apartment / floor': 'الشقة / الطابق', 'Delivery instructions': 'تعليمات التوصيل', 'Pinned location': 'الموقع المحدد',
    'Choose a map pin before saving this address.': 'حدد موقعاً على الخريطة قبل حفظ هذا العنوان.',
    'Choose location on map': 'اختر الموقع على الخريطة', 'Make this my default address': 'اجعل هذا عنواني الافتراضي',
    'Save address': 'حفظ العنوان', 'Choose delivery location': 'اختر موقع التوصيل',
    'Map tiles and address searches use OpenStreetMap services. GPS is optional and runs only after you request it.': 'تستخدم الخريطة والبحث عن العناوين خدمات OpenStreetMap. الموقع اختياري ولا يعمل إلا بعد طلبك.',
    'Search an address or place': 'ابحث عن عنوان أو مكان', 'Search': 'بحث', 'Use my location': 'استخدم موقعي',
    'Tap the map to place the delivery pin.': 'اضغط على الخريطة لوضع دبوس التوصيل.',
    'Confirm map location': 'تأكيد موقع الخريطة', 'Enter at least 3 characters to search.': 'أدخل ٣ أحرف على الأقل للبحث.',
    'Location is unavailable in this browser. Search or move the map pin instead.': 'الموقع غير متاح في هذا المتصفح. ابحث عن عنوان أو حرّك الدبوس يدوياً.',
    'Location permission was denied. Search for an address or move the pin manually.': 'تم رفض إذن الموقع. ابحث عن عنوان أو حرّك الدبوس يدوياً.',
    'Could not determine your location. Search for an address or move the pin manually.': 'تعذر تحديد موقعك. ابحث عن عنوان أو حرّك الدبوس يدوياً.',
    'Choose a location on the map before confirming.': 'اختر موقعاً على الخريطة قبل التأكيد.',
    'Checkout · Step 1 of 2': 'إتمام الطلب · الخطوة ١ من ٢', 'Checkout': 'إتمام الطلب', 'Select Delivery or Pickup, then review the server-calculated total.': 'اختر التوصيل أو الاستلام ثم راجع الإجمالي المحسوب على الخادم.',
    'Delivery option': 'طريقة الاستلام', 'Delivery': 'توصيل', 'Pickup': 'استلام',
    'Delivery address': 'عنوان التوصيل', 'Add a different address': 'إضافة عنوان آخر',
    'Delivery fee': 'رسوم التوصيل', 'Discount': 'الخصم', 'Final total': 'الإجمالي النهائي',
    'Payment method': 'طريقة الدفع', 'Cash Payment Only': 'الدفع النقدي فقط', 'Cash on Delivery': 'الدفع نقداً عند التوصيل',
    'Cash at Store (Takeaway)': 'الدفع نقداً في المتجر (طلبات خارجية)', 'Cash payments only. All orders are strictly for delivery or takeaway — no dine-in available.': 'الدفع نقداً فقط. جميع الطلبات للتوصيل أو الاستلام الخارجي فقط — لا يتوفر تناول الطعام في المطعم.',
    'Takeout & Delivery Only: All orders are prepared for takeaway or delivery. Dine-in is not available.': 'للطلبات الخارجية والتوصيل فقط: تُجهز جميع الطلبات للاستلام أو التوصيل. لا يتوفر تناول الطعام داخل المطعم.',
    'Review and place order': 'راجع وأرسل الطلب', 'Your order is created only when you tap Place Order. This website does not process card payments.': 'لن يُنشأ طلبك إلا عند الضغط على إرسال الطلب. هذا الموقع لا يعالج مدفوعات البطاقات.',
    'Payment has not been confirmed.': 'لم يتم تأكيد الدفع.', 'Map pin not saved': 'لم يتم حفظ موقع الخريطة',
    'No orders have been placed from this account yet.': 'لم تُقدّم طلبات من هذا الحساب بعد.',
    'Rewards are tracked here. Ask restaurant staff how configured rewards can be redeemed.': 'يتم تتبع النقاط هنا. اسأل موظفي المطعم عن كيفية استبدال المكافآت المُعدة.',
    'Restaurant contact details have not been configured yet.': 'لم يتم إعداد بيانات الاتصال بالمطعم بعد.',
    'Restaurant story has not been added yet.': 'لم تتم إضافة قصة المطعم بعد.',
    'About': 'عن', 'serves freshly prepared food in Erbil. Browse the menu, place an order, and follow its status securely from this device.': 'يقدم طعامًا طازج التحضير في أربيل. استعرض القائمة وقدّم طلبًا وتابع حالته بأمان من هذا الجهاز.',
    'Settings': 'الإعدادات', 'Language': 'اللغة', 'About Us': 'من نحن', 'Close menu': 'إغلاق القائمة',
    'Open menu': 'فتح القائمة', 'New Burger home': 'الصفحة الرئيسية لـ New Burger',
    'Customer menu': 'قائمة العملاء', 'Menu': 'القائمة', 'Cart': 'السلة', 'item': 'عنصر', 'items': 'عناصر', 'View Cart': 'عرض السلة', 'Customize': 'تخصيص', 'Add one': 'أضف واحدة', 'Remove one': 'أزل واحدة', 'All': 'الكل', 'Search dishes…': 'ابحث عن الأطباق…',
    'Search menu': 'ابحث في القائمة', 'Sort': 'ترتيب', 'Featured': 'مميز', 'Price: low to high': 'السعر: من الأقل للأعلى',
    'Price: high to low': 'السعر: من الأعلى للأقل', 'Name': 'الاسم', 'Max price': 'الحد الأقصى للسعر', 'Any price': 'أي سعر',
    'WHAT SOUNDS GOOD?': 'ما الذي تشتهيه؟', 'Explore the menu': 'استكشف القائمة', 'Choose a favourite. We’ll take care of the rest.': 'اختر ما تفضله، وسنهتم بالباقي.',
    'FRESHLY MADE · DELIVERED TO YOU': 'طازج التحضير · يصلك حتى بابك', 'Good food.': 'طعام شهي.', 'Good mood.': 'مزاج رائع.',
    'Freshly prepared favourites, made for sharing.': 'نحضّر أطباقك المفضّلة طازجة لتستمتع بها.',
    'Made fresh, packed with care, and delivered to your door in Erbil.': 'نحضّر الطعام طازجًا ونوصله بعناية إلى بابك في أربيل.',
    'Freshly prepared gourmet burger': 'برغر فاخر محضّر طازجًا',
    'Order now': 'اطلب الآن', 'How ordering works →': 'كيف تطلب ←', 'Made with care': 'محضّر بعناية',
    'Fresh food, every order': 'طعام طازج مع كل طلب', 'Freshly prepared': 'تحضير طازج', 'Made when you order': 'يُحضّر عند الطلب',
    'Easy delivery': 'توصيل سهل', 'Tell us where you are': 'أخبرنا بموقعك', 'Made for you': 'صُنع من أجلك',
    'Notes and extras welcome': 'أضف ملاحظات أو إضافات', 'THREE EASY STEPS': 'ثلاث خطوات سهلة',
    'Your next favourite meal is close.': 'وجبتك المفضلة التالية على بُعد خطوات.', 'Choose your food': 'اختر طعامك',
    'Explore the menu and add your favourites to the basket.': 'استكشف القائمة وأضف أطباقك المفضلة إلى السلة.',
    'Tell us where': 'أخبرنا بموقعك', 'Enter your street, building and delivery instructions.': 'أدخل الشارع والمبنى وتعليمات التوصيل.',
    'Follow your order': 'تابع طلبك', 'See each update from confirmation to delivery.': 'تابع كل تحديث من التأكيد حتى التوصيل.',
    'NEED TO KNOW?': 'هل لديك أسئلة؟', 'Frequently asked questions': 'الأسئلة الشائعة', 'How do I place an order?': 'كيف أقدّم طلبًا؟',
    'Choose dishes, add them to your cart, enter your contact and delivery details, then submit the order.': 'اختر الأطباق وأضفها إلى السلة، ثم أدخل بيانات التواصل والتوصيل وأرسل الطلب.',
    'Can I pay cash on delivery?': 'هل يمكنني الدفع نقدًا عند التوصيل؟',
    'Cash on delivery is available. Card and online payment processing are not configured.': 'الدفع نقدًا عند التوصيل متاح. لم يتم إعداد الدفع بالبطاقة أو عبر الإنترنت.',
    'How do I track my order?': 'كيف أتتبع طلبي؟',
    'Open “My Orders / Order Tracking” on this device to securely view orders placed here and their latest status.': 'افتح «طلباتي / تتبع الطلب» على هذا الجهاز لعرض الطلبات التي قُدمت منه وحالتها الأخيرة بأمان.',
    'Can I add delivery instructions?': 'هل يمكنني إضافة تعليمات للتوصيل؟', 'Yes. Add your street, building, floor or apartment, and any useful notes at checkout.': 'نعم. أضف الشارع والمبنى والطابق أو الشقة وأي ملاحظات مفيدة عند إتمام الطلب.',
    'Nearby landmark, work address, gate colour…': 'معلم قريب أو عنوان العمل أو لون البوابة…',
    'Paste a map link if you have one': 'أدخل رابط الخريطة إن وجد',
    'A live interactive map is not configured.': 'لم يتم إعداد خريطة تفاعلية مباشرة.',
    '07xx xxx xxxx': '٠٧xx xxx xxxx',
    'The request could not be completed.': 'تعذر إكمال الطلب.',
    'Restaurant admin': 'إدارة المطعم', 'Fresh food, made with care.': 'طعام طازج، محضّر بعناية.', 'RESTAURANT': 'مطعم',
    'Customize': 'تخصيص', 'Out of stock': 'غير متوفر', 'No dishes found. Try another search.': 'لم يتم العثور على أطباق. جرّب بحثًا آخر.',
    'Ingredients:': 'المكونات:', 'Estimated preparation:': 'وقت التحضير المتوقع:', 'minutes': 'دقيقة',
    'This item is currently unavailable.': 'هذا الصنف غير متوفر حاليًا.', 'Optional extras': 'إضافات اختيارية',
    'Special instructions': 'تعليمات خاصة', 'Any preferences for this dish?': 'هل لديك تفضيلات لهذا الطبق؟',
    'From': 'ابتداءً من', 'Add to cart': 'أضف إلى السلة', 'Maximum quantity per dish is 99.': 'الحد الأقصى لكل طبق هو ٩٩.',
    'Added to your cart': 'تمت الإضافة إلى سلتك', 'each': 'لكل قطعة', 'Extras:': 'الإضافات:',
    'Note:': 'ملاحظة:', 'Total:': 'الإجمالي:', 'Delivery to:': 'التوصيل إلى:', 'Status:': 'الحالة:',
    'Your cart': 'سلتك', 'A few good things are on their way.': 'اختيارات لذيذة في طريقها إليك.',
    'Remove one': 'إزالة واحدة', 'Add one': 'إضافة واحدة', 'Your cart is empty. Add something delicious from the menu.': 'سلتك فارغة. أضف طبقًا لذيذًا من القائمة.',
    'Subtotal': 'المجموع الفرعي', 'Coupon code': 'رمز القسيمة', 'Apply': 'تطبيق', 'Coupon': 'القسيمة', 'applied': 'تم تطبيقها', 'off': 'خصم',
    'Delivery fee, if any, will be confirmed by the restaurant.': 'سيؤكد المطعم رسوم التوصيل إن وجدت.',
    'Continue to delivery details →': 'تابع إلى تفاصيل التوصيل ←', 'Delivery details': 'تفاصيل التوصيل',
    'Please tell us how to find you. Fields marked * are required.': 'أخبرنا بكيفية الوصول إليك. الحقول المميزة بـ * مطلوبة.',
    'Full name *': 'الاسم الكامل *', 'Your name': 'اسمك', 'Phone number *': 'رقم الهاتف *', 'City *': 'المدينة *',
    'Street / area *': 'الشارع / المنطقة *', 'Street or neighbourhood': 'الشارع أو الحي', 'House / building number *': 'رقم المنزل / المبنى *',
    'Building number': 'رقم المبنى', 'Apartment / floor': 'الشقة / الطابق', 'Delivery notes': 'ملاحظات التوصيل',
    'Map link (optional)': 'رابط الخريطة (اختياري)', 'Payment method *': 'طريقة الدفع *',
    'Nearby landmark, work address, gate colour…': 'معلم قريب أو عنوان العمل أو لون البوابة…',
    'Paste a map link if you have one': 'أدخل رابط الخريطة إن وجد',
    'A live interactive map is not configured.': 'لم يتم إعداد خريطة تفاعلية مباشرة.',
    '07xx xxx xxxx': '٠٧xx xxx xxxx', 'Erbil': 'أربيل',
    'The request could not be completed.': 'تعذر إكمال الطلب.',
    'Cash on delivery': 'الدفع نقدًا عند التوصيل', 'Order total': 'إجمالي الطلب', 'Your order will be sent to the restaurant for confirmation.': 'سيُرسل طلبك إلى المطعم لتأكيده.',
    'Place order': 'إرسال الطلب', 'Order received!': 'تم استلام الطلب!', 'The restaurant has received your order.': 'استلم المطعم طلبك.',
    'My orders': 'طلباتي', 'View my orders': 'عرض طلباتي', 'Loading your order history…': 'جارٍ تحميل سجل طلباتك…',
    'Order status is refreshed from the restaurant.': 'يتم تحديث حالة الطلب من المطعم.',
    'No orders yet. Your first favourite is waiting in the menu.': 'لا توجد طلبات بعد. طبقك المفضل بانتظارك في القائمة.',
    'Track an order securely': 'تتبع طلبك بأمان',
    'Enter the order number and private tracking code from your confirmation.': 'أدخل رقم الطلب ورمز التتبع الخاص من رسالة التأكيد.',
    'Order Received': 'تم استلام الطلب', 'Out for Delivery': 'خرج للتوصيل', 'Ready for Takeaway': 'جاهز للاستلام',
    'Order again': 'اطلب مرة أخرى', 'This order was cancelled.': 'تم إلغاء هذا الطلب.',
    'item added to your cart.': 'تمت إضافة عنصر إلى سلتك.', 'items added to your cart.': 'تمت إضافة العناصر إلى سلتك.',
    'Some items or options are no longer available.': 'بعض العناصر أو الخيارات لم تعد متاحة.',
    'No available items from this order could be added.': 'تعذر إضافة أي عناصر متاحة من هذا الطلب.',
    'Order number': 'رقم الطلب', 'Order number:': 'رقم الطلب:', 'Private tracking code': 'رمز التتبع الخاص', 'Find order': 'العثور على الطلب',
    'Save this private tracking code to check your order on another device. Keep it private.': 'احفظ رمز التتبع الخاص هذا لمتابعة طلبك من جهاز آخر، واحتفظ به سرياً.',
    'About New Burger': 'عن New Burger',
    'Our approach': 'نهجنا', 'We focus on fresh food, careful preparation, and making it straightforward to order and follow your delivery.': 'نركز على الطعام الطازج والتحضير بعناية وتسهيل تقديم الطلب ومتابعة توصيله.',
    'Choose your language': 'اختر لغتك', 'Language changes apply across the customer website.': 'يسري تغيير اللغة على موقع العملاء بالكامل.',
    'English': 'الإنجليزية', 'Kurdish Sorani': 'الكردية السورانية', 'Arabic': 'العربية',
    'Pending approval': 'بانتظار التأكيد', 'Confirmed': 'تم التأكيد', 'Preparing': 'قيد التحضير',
    'Ready': 'جاهز', 'Out for delivery': 'في الطريق للتوصيل', 'Delivered': 'تم التوصيل', 'Cancelled': 'ملغي',
    'Website design could not be loaded: ': 'تعذر تحميل تصميم الموقع: ',
    'The restaurant menu has been updated.': 'تم تحديث قائمة المطعم.',
    'Restaurant': 'مطعم', 'Order not found.': 'لم يتم العثور على الطلب.',
    'A little something special.': 'لمسة مميزة صغيرة.',
    'MADE FRESH TO ORDER': 'يُحضّر طازجًا عند الطلب',
    'Dar Signature Burger': 'برغر دار المميز', 'Crispy Chicken Burger': 'برغر الدجاج المقرمش',
    'Garden Fresh Salad': 'سلطة خضار طازجة', 'Loaded Fries': 'بطاطس محملة',
    'Chicken Wrap': 'لفائف الدجاج', 'Margherita Pizza': 'بيتزا مارغريتا',
    'Chocolate Brownie': 'براوني الشوكولاتة', 'Fresh Lemon Mint': 'ليمون ونعناع طازج', 'Iced Coffee': 'قهوة مثلجة',
    'Burgers': 'برغر', 'Salads': 'سلطات', 'Sides': 'مقبلات', 'Wraps': 'لفائف',
    'Pizza': 'بيتزا', 'Desserts': 'حلويات', 'Drinks': 'مشروبات',
    'Juicy grilled beef, house sauce, lettuce and tomato.': 'لحم بقري مشوي طري مع صلصة المطعم والخس والطماطم.',
    'Crispy chicken, fresh greens and creamy sauce.': 'دجاج مقرمش وخضروات طازجة وصلصة كريمية.',
    'Crunchy greens, cucumber, tomato and lemon dressing.': 'خضروات مقرمشة وخيار وطماطم وتتبيلة الليمون.',
    'Golden fries with herbs and our signature seasoning.': 'بطاطس ذهبية مع الأعشاب وتوابلنا المميزة.',
    'Grilled chicken, crunchy vegetables and garlic sauce.': 'دجاج مشوي وخضروات مقرمشة وصلصة الثوم.',
    'Tomato, mozzarella and fragrant basil.': 'طماطم وموزاريلا وريحان عطري.',
    'Rich chocolate brownie, soft in the middle.': 'براوني شوكولاتة غنية وطرية من الداخل.',
    'Refreshing lemon, mint and chilled water.': 'ليمون منعش ونعناع وماء بارد.',
    'Smooth coffee served over ice.': 'قهوة ناعمة تُقدّم مع الثلج.',
    'BESTSELLER': 'الأكثر مبيعًا', 'CRISPY': 'مقرمش', 'FRESH': 'طازج', 'POPULAR': 'شائع',
    'FAVOURITE': 'مفضل', 'CLASSIC': 'كلاسيكي', 'SWEET': 'حلو', 'REFRESHING': 'منعش', 'CHILLED': 'مثلج',
    'Order Online': 'اطلب عبر الإنترنت', 'Language updated.': 'تم تحديث اللغة.'
  }

};
let currentLanguage = localStorage.getItem('dar_language') || 'en';
const originalTextNodes = new WeakMap();
const originalAttributes = new WeakMap();
let menu = [];
let siteDesign = null;
let previewDesignOverride = null;
let cart = JSON.parse(localStorage.getItem('dar_cart') || '{}');
let orderTrackers = JSON.parse(localStorage.getItem('dar_order_trackers') || '[]');
let favoriteIds = new Set(JSON.parse(localStorage.getItem('dar_favorites') || '[]'));
let promotions = [];
let approvedReviews = [];
let customerAccount = null;
let customerOrdersById = new Map();
let customerOrdersRefreshTimer = null;
let checkoutRequestKey = null;
let checkoutAddressFlow = false;
let leafletPromise = null;
let addressMap = null;
let addressMarker = null;
let activeCategory = 'All';
let activeSort = 'featured';
let toastTimer;
const money = amount => `${new Intl.NumberFormat('en-US').format(amount)} IQD`;
function localized(text) {
  const translation = TRANSLATIONS[currentLanguage]?.[text];
  if (translation) return translation;
  const preparation = text.match(/^Estimated preparation: (\d+) minutes$/);
  if (preparation) return `${localized('Estimated preparation:')} ${preparation[1]} ${localized('minutes')}`;
  const placeOrder = text.match(/^Place order · (.+)$/);
  if (placeOrder) return `${localized('Place order')} · ${placeOrder[1]}`;
  const customize = text.match(/^Customize (.+)$/);
  if (customize) return `${localized('Customize')} ${localized(customize[1])}`;
  return text;
}
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function applyTranslations() {
  const language = LANGUAGES[currentLanguage] ? currentLanguage : 'en';
  currentLanguage = language;
  document.documentElement.lang = language;
  document.documentElement.dir = LANGUAGES[language].direction;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('[data-no-translate]')) continue;
    let record = originalTextNodes.get(node);
    if (!record) {
      record = { source: node.nodeValue, rendered: node.nodeValue };
      originalTextNodes.set(node, record);
    } else if (node.nodeValue !== record.rendered) {
      record.source = node.nodeValue;
    }
    const source = record.source;
    const trimmed = source.trim();
    if (!trimmed) {
      record.rendered = node.nodeValue;
      continue;
    }
    const start = source.indexOf(trimmed);
    node.nodeValue = `${source.slice(0, start)}${localized(trimmed)}${source.slice(start + trimmed.length)}`;
    record.rendered = node.nodeValue;
  }

  document.body.querySelectorAll('*').forEach(element => {
    ['aria-label', 'placeholder', 'title', 'alt'].forEach(attribute => {
      if (!element.hasAttribute(attribute)) return;
      let sourceAttributes = originalAttributes.get(element);
      if (!sourceAttributes) {
        sourceAttributes = {};
        originalAttributes.set(element, sourceAttributes);
      }
      if (!(attribute in sourceAttributes)) sourceAttributes[attribute] = element.getAttribute(attribute);
      element.setAttribute(attribute, localized(sourceAttributes[attribute]));
    });
  });
  $('#currentLanguage').textContent = LANGUAGES[language].native;
  if (siteDesign) {
    const brand = siteDesign.restaurantName || 'New Burger';
    document.title = `${brand} | ${localized('Order Online')}`;
  }
}

function setLanguage(language) {
  if (!LANGUAGES[language]) return;
  currentLanguage = language;
  localStorage.setItem('dar_language', language);
  applyTranslations();
  if (siteDesign) applyDesign(siteDesign);
  renderPromotions();
  closeModal();
  toast(localized('Language updated.'));
}

function openLanguageModal() {
  openModal(`<h2 id="modalTitle">Choose your language</h2>
    <p class="modal-intro">Language changes apply across the customer website.</p>
    <div class="language-options">${Object.entries(LANGUAGES).map(([code, language]) =>
      `<button class="language-option ${currentLanguage === code ? 'active' : ''}" type="button" data-language="${code}" aria-pressed="${currentLanguage === code}">
        <span>${escapeHTML(language.label)}</span><b lang="${code}" dir="${language.direction}">${escapeHTML(language.native)}</b>
      </button>`
    ).join('')}</div>`);
}

function openAboutModal() {
  const restaurantName = siteDesign?.restaurantName || 'New Burger';
  const name = escapeHTML(restaurantName);
  const story = siteDesign?.localizedContent?.[currentLanguage]?.aboutStory?.trim() || siteDesign?.aboutStory?.trim();
  openModal(`<article class="about-page"><span class="eyebrow">About Us</span>
    <h2 id="modalTitle"><span>About </span><span data-no-translate>${name}</span></h2>
    ${siteDesign?.aboutImage ? `<img class="about-hero-image" src="${escapeHTML(siteDesign.aboutImage)}" alt="${escapeHTML(restaurantName)}" loading="lazy" decoding="async">` : ''}
    ${story
      ? `<p class="modal-intro" data-no-translate>${escapeHTML(story)}</p>`
      : `<p class="empty-state" data-i18n>Restaurant story has not been added yet.</p>`}
    ${siteDesign?.contactAddress ? `<p><b>${escapeHTML(localized('Address'))}:</b> <span data-no-translate>${escapeHTML(siteDesign.contactAddress)}</span></p>` : ''}
    ${siteDesign?.contactPhone ? `<p><b>${escapeHTML(localized('Phone'))}:</b> <a dir="ltr" href="tel:${encodeURIComponent(siteDesign.contactPhone)}">${escapeHTML(siteDesign.contactPhone)}</a></p>` : ''}
    ${siteDesign?.contactEmail ? `<p><b>${escapeHTML(localized('Email'))}:</b> <a href="mailto:${encodeURIComponent(siteDesign.contactEmail)}">${escapeHTML(siteDesign.contactEmail)}</a></p>` : ''}
  </article>`);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'The request could not be completed.');
    error.status = response.status;
    if (result.orderId) error.orderId = result.orderId;
    throw error;
  }
  return result;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = localized(message);
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2500);
}

function saveCart() {
  localStorage.setItem('dar_cart', JSON.stringify(cart));
  renderCartCount();
}

function renderCartCount() {
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  document.body.classList.toggle('has-cart', count > 0);
  $('#cartCount').textContent = count;
  $('#cartCount').hidden = count === 0;
  $('#bottomCartCount').textContent = count;
  $('#cartBtn').setAttribute('aria-label', `${localized('Cart')}, ${count} ${localized(count === 1 ? 'item' : 'items')}`);
  const entries = cartEntries();
  const total = entries.reduce((sum, entry) =>
    sum + (entry.item.price + entry.extras.reduce((extraTotal, extra) => extraTotal + extra.price, 0)) * entry.quantity, 0);
  const floatingBar = $('#floatingCartBar');
  floatingBar.hidden = count === 0 || !$('#modalBackdrop').classList.contains('hidden');
  $('#floatingCartCount').textContent = `${count} ${localized(count === 1 ? 'item' : 'items')}`;
  $('#floatingCartTotal').textContent = money(total);
  renderProductQuantities();
}

function showCartButtonFeedback(button) {
  const feedbackButton = button.closest('[data-product]')?.querySelector('[data-product-stepper] [data-cart-add]') || button;
  feedbackButton.classList.add('is-added');
  clearTimeout(cartFeedbackTimers.get(feedbackButton));
  cartFeedbackTimers.set(feedbackButton, setTimeout(() => {
    feedbackButton.classList.remove('is-added');
    cartFeedbackTimers.delete(feedbackButton);
  }, 450));
}

function productQuantity(id) {
  return cartEntries().reduce((count, entry) => count + (entry.item.id === id ? entry.quantity : 0), 0);
}

function renderProductQuantities() {
  document.querySelectorAll('[data-product-quantity]').forEach(counter => {
    const card = counter.closest('[data-product]');
    if (!card) return;
    const quantity = productQuantity(Number(card.dataset.product));
    if (counter.textContent !== String(quantity)) counter.textContent = quantity;
    const addControl = card.querySelector('[data-product-add-control]');
    const stepper = card.querySelector('[data-product-stepper]');
    if (addControl) addControl.hidden = quantity > 0;
    if (stepper) stepper.hidden = quantity === 0;
  });
}

function applyDesign(design) {
  siteDesign = design;
  const root = document.body.style;
  root.setProperty('--bg', design.backgroundColor || '#fffaf4');
  root.setProperty('--paper', design.secondaryBackground || '#ffffff');
  root.setProperty('--ink', design.textColor || '#202124');
  root.setProperty('--muted', design.mutedColor || '#626873');
  root.setProperty('--green', design.accentColor || '#c62832');
  root.setProperty('--green2', design.accentColor || '#c62832');
  root.setProperty('--accent', design.goldColor || '#f3c744');
  root.setProperty('--card-color', design.cardColor || '#ffffff');
  root.setProperty('--line', design.borderColor || '#e8e3dc');
  root.setProperty('--corner-radius', `${design.cornerRadius || 14}px`);
  root.setProperty('--hero-overlay', `${design.heroOverlay ?? 48}%`);
  const photo = design.backgroundStyle === 'photo' || design.backgroundStyle === 'both';
  const pattern = design.backgroundStyle === 'pattern' || design.backgroundStyle === 'both';
  const layers = [];
  if (photo && design.backgroundImage) layers.push(`linear-gradient(#20212445,#20212480),url("${design.backgroundImage.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}")`);
  else if (photo) layers.push('radial-gradient(ellipse at 15% 4%,#f3c74426,transparent 36%)');
  if (pattern) layers.push('repeating-linear-gradient(135deg,#20212406 0 1px,transparent 1px 10px)');
  root.backgroundImage = layers.length ? layers.join(',') : 'none';
  root.backgroundSize = photo && design.backgroundImage ? 'cover,cover' : 'auto';
  root.backgroundPosition = photo && design.backgroundImage ? 'center,center top' : '';
  root.backgroundAttachment = photo && design.backgroundImage ? 'fixed,fixed' : '';
  document.querySelectorAll('#featured').forEach(element => { element.hidden = design.showFeatured === false; });
  document.querySelectorAll('#offers').forEach(element => { element.hidden = design.showOffers === false; });
  document.querySelectorAll('.benefits').forEach(element => { element.hidden = design.showBenefits === false; });
  const localizedCopy = design.localizedContent?.[currentLanguage] || design.localizedContent?.en || {};
  const english = design.localizedContent?.en || {};
  $('#heroTitle').textContent = localizedCopy.heroTitle || english.heroTitle || 'Good food. Good mood.';
  $('#heroSubtitle').textContent = localizedCopy.heroSubtitle || english.heroSubtitle || 'Freshly prepared favourites, made for sharing.';
  $('#heroButtonText').textContent = localizedCopy.heroButton || english.heroButton || 'Order now';
  const hero = $('#heroImage');
  if (hero) {
    hero.src = design.heroImage || hero.dataset.defaultSrc;
  }
  document.title = `${design.restaurantName} | ${localized(window.location.pathname === '/menu' ? 'Our Menu' : 'Order Online')}`;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = design.backgroundColor || '#fffaf4';
  const brandName = design.restaurantName.replace(/\s+Restaurant$/i, '') || design.restaurantName;
  document.querySelectorAll('[data-brand-name]').forEach(element => {
    element.textContent = brandName;
  });
  document.querySelectorAll('[data-brand-logo]').forEach(element => {
    if (design.logoImage) {
      const image = document.createElement('img');
      image.src = design.logoImage;
      image.alt = `${design.restaurantName} logo`;
      image.className = 'brand-logo-image';
      element.replaceChildren(image);
    } else {
      element.textContent = design.logoText;
    }
  });
  applyTranslations();
}

window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.data?.type !== 'website-design-preview' ||
      !event.data.design || typeof event.data.design !== 'object') return;
  previewDesignOverride = event.data.design;
  applyDesign(previewDesignOverride);
  toast('Preview only — this design has not been published.');
});

function renderCategories() {
  const categories = ['All', ...new Set(menu.map(item => item.category))];
  if (!categories.includes(activeCategory)) activeCategory = 'All';
  $('#categoryRow').innerHTML = categories.map(category =>
    `<button class="category-chip ${category === activeCategory ? 'active' : ''}" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`
  ).join('');
  applyTranslations();
}

function productCard(item) {
  const isFavorite = favoriteIds.has(item.id);
  const quantity = productQuantity(item.id);
  return `<article class="menu-card ${item.available === false ? 'unavailable' : ''}" data-product="${item.id}">
    <div class="menu-card-image">
      ${item.image
        ? `<img class="food-art food-image" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy" decoding="async">`
        : `<div class="food-art ${escapeHTML(item.art)}" aria-hidden="true">${escapeHTML(item.emoji)}</div>`}
      <button class="favorite-toggle ${isFavorite ? 'is-favorite' : ''}" type="button" data-favorite="${item.id}" aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${isFavorite}">${isFavorite ? '♥' : '♡'}</button>
    </div>
    <div class="menu-card-body">
      <div class="menu-card-top"><h3>${escapeHTML(item.name)}</h3><span class="price">${money(item.price)}</span></div>
      <p>${escapeHTML(item.desc)}</p>
      <div class="card-bottom"><span class="tag">${escapeHTML(item.tag)}</span>
        ${item.available === false
          ? `<span class="availability-label">${escapeHTML(localized('Out of stock'))}</span>`
          : `<div class="product-purchase-controls">
              <button type="button" class="details-btn product-add-btn" data-cart-add="${item.id}" data-product-add-control aria-label="${escapeHTML(localized('Add to cart'))} ${escapeHTML(item.name)}">${escapeHTML(localized('Add to cart'))}</button>
              <div class="product-quantity-control" data-product-stepper${quantity === 0 ? ' hidden' : ''}>
                <button type="button" data-cart-remove="${item.id}" aria-label="${escapeHTML(localized('Remove one'))} ${escapeHTML(item.name)}"${quantity === 0 ? ' disabled' : ''}>−</button>
                <span data-product-quantity aria-live="polite">${quantity}</span>
                <button type="button" data-cart-add="${item.id}" aria-label="${escapeHTML(localized('Add one'))} ${escapeHTML(item.name)}">+</button>
              </div>
              ${item.extras?.length ? `<button type="button" class="details-btn customize-btn" data-product-customize="${item.id}" data-i18n>Customize</button>` : ''}
            </div>`}
      </div>
    </div>
  </article>`;
}

function renderFeatured() {
  const featured = menu.filter(item => item.available !== false).slice(0, 3);
  $('#featuredGrid').innerHTML = featured.length
    ? featured.map(productCard).join('')
    : `<p class="empty-state">${escapeHTML(localized('No featured dishes are available right now.'))}</p>`;
  applyTranslations();
}

function renderPromotions() {
  $('#offersGrid').innerHTML = promotions.length
    ? promotions.map(promotion => `<article class="offer-card">${promotion.image ? `<img class="offer-image" src="${escapeHTML(promotion.image)}" alt="${escapeHTML(promotion.title)}" loading="lazy" decoding="async">` : '<span class="offer-mark" aria-hidden="true">％</span>'}<div><h3 data-no-translate>${escapeHTML(promotion.title)}</h3><p data-no-translate>${escapeHTML(promotion.description)}</p><small>${escapeHTML(localized('Valid through'))} ${new Date(promotion.endsAt).toLocaleDateString(currentLanguage)}</small></div></article>`).join('')
    : `<p class="empty-state">${escapeHTML(localized('No active promotions right now.'))}</p>`;
  applyTranslations();
}

async function toggleFavorite(id) {
  const previous = new Set(favoriteIds);
  if (favoriteIds.has(id)) favoriteIds.delete(id);
  else favoriteIds.add(id);
  if (customerAccount) {
    try {
      const result = await api('/api/customer/favorites', {
        method: 'PUT',
        body: JSON.stringify({ ids: [...favoriteIds] })
      });
      favoriteIds = new Set(result.favorites);
      customerAccount.favorites = result.favorites;
    } catch (error) {
      favoriteIds = previous;
      toast(error.message);
    }
  }
  localStorage.setItem('dar_favorites', JSON.stringify([...favoriteIds]));
  renderMenu();
  renderFeatured();
}

function favoritesModal() {
  const favorites = menu.filter(item => favoriteIds.has(item.id) && item.available !== false);
  openModal(`<h2 id="modalTitle" data-i18n>Your favourites</h2>
    ${favorites.length
      ? `<div class="menu-grid favorites-grid">${favorites.map(productCard).join('')}</div>`
      : `<p class="empty-state" data-i18n>No favourites saved yet. Use the heart on a dish to save it here.</p>`}`);
}

function reviewsModal() {
  const reviews = approvedReviews.length
    ? `<div class="review-list">${approvedReviews.map(review => `<article class="review-card"><div class="review-rating" aria-label="${escapeHTML(localized('Rating'))}: ${review.rating} out of 5">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div><p data-no-translate>${escapeHTML(review.comment)}</p><small data-no-translate>${escapeHTML(review.displayName)}</small></article>`).join('')}</div>`
    : `<p class="empty-state" data-i18n>No approved reviews yet.</p>`;
  openModal(`<h2 id="modalTitle" data-i18n>Customer reviews</h2>${reviews}
    <form id="reviewForm" class="order-lookup">
      <h3 data-i18n>Share feedback for a delivered order</h3>
      <p class="hint" data-i18n>Reviews are accepted only for delivered orders, verified by their private tracking code. Reviews appear publicly after restaurant approval.</p>
      <div class="field"><label for="reviewOrderId" data-i18n>Order number</label><input id="reviewOrderId" name="orderId" required autocomplete="off"></div>
      <div class="field"><label for="reviewToken" data-i18n>Private tracking code</label><input id="reviewToken" name="trackingToken" required autocomplete="off" dir="ltr"></div>
      <div class="field"><label for="reviewRating" data-i18n>Rating</label><select id="reviewRating" name="rating" required><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select></div>
      <div class="field"><label for="reviewName" data-i18n>Display name (optional)</label><input id="reviewName" name="displayName" maxlength="60" autocomplete="name"></div>
      <div class="field"><label for="reviewComment" data-i18n>Your review</label><textarea id="reviewComment" name="comment" maxlength="1000" required></textarea></div>
      <button class="button button-dark wide" type="submit" data-i18n>Submit review</button><p id="reviewMessage" class="form-error" role="status"></p>
    </form>`);
}

async function rewardsModal() {
  const design = siteDesign || {};
  if (!design.rewardsPointsPer1000 || !design.rewardsThreshold) {
    openModal(`<h2 id="modalTitle" data-i18n>Loyalty &amp; Rewards</h2><p class="empty-state" data-i18n>Rewards are not configured yet.</p>`);
    return;
  }
  openModal(`<h2 id="modalTitle" data-i18n>Loyalty &amp; Rewards</h2><p class="modal-intro" data-i18n>Track rewards from delivered orders saved on this device.</p><p class="loading-state" data-i18n>Loading rewards…</p>`);
  try {
    const results = await Promise.all(orderTrackers.map(async tracker => {
      const order = await api(`/api/orders/${encodeURIComponent(tracker.id)}`, { headers: { 'X-Order-Token': tracker.token } });
      return order.rewardPoints || 0;
    }));
    const points = results.reduce((sum, value) => sum + value, 0);
    openModal(`<h2 id="modalTitle" data-i18n>Loyalty &amp; Rewards</h2>
      <p class="modal-intro" data-i18n>Track rewards from delivered orders saved on this device.</p>
      <div class="rewards-summary"><span data-i18n>Points earned</span><b>${points}</b></div>
      <div class="rewards-summary"><span data-i18n>Reward threshold</span><b>${design.rewardsThreshold}</b></div>
      <p class="hint" data-no-translate>${escapeHTML(design.rewardsDescription || '')}</p>
      <p class="hint" data-i18n>Rewards are tracked here. Ask restaurant staff how configured rewards can be redeemed.</p>`);
  } catch (error) {
    openModal(`<h2 id="modalTitle" data-i18n>Loyalty &amp; Rewards</h2><p class="form-error" role="alert">${escapeHTML(error.message)}</p><p class="hint" data-i18n>Save the order number and private tracking code on this device to include its rewards.</p>`);
  }
}

function contactModal() {
  const design = siteDesign || {};
  const details = [
    design.contactPhone && `<p><b>${escapeHTML(localized('Phone'))}:</b> <a dir="ltr" href="tel:${encodeURIComponent(design.contactPhone)}">${escapeHTML(design.contactPhone)}</a></p>`,
    design.contactEmail && `<p><b>${escapeHTML(localized('Email'))}:</b> <a href="mailto:${encodeURIComponent(design.contactEmail)}">${escapeHTML(design.contactEmail)}</a></p>`,
    design.contactAddress && `<p><b>${escapeHTML(localized('Address'))}:</b> <span data-no-translate>${escapeHTML(design.contactAddress)}</span></p>`
  ].filter(Boolean);
  openModal(`<h2 id="modalTitle" data-i18n>Contact Us</h2>
    ${details.length ? details.join('') : `<p class="empty-state" data-i18n>Restaurant contact details have not been configured yet.</p>`}`);
}

function renderMenu() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const maximumPrice = Number($('#priceFilter').value) || Infinity;
  const items = menu.filter(item =>
    (activeCategory === 'All' || item.category === activeCategory) &&
    item.price <= maximumPrice &&
    `${item.name} ${localized(item.name)} ${item.desc} ${localized(item.desc)} ${item.category} ${localized(item.category)}`.toLowerCase().includes(query)
  );
  if (activeSort === 'price-asc') items.sort((left, right) => left.price - right.price);
  if (activeSort === 'price-desc') items.sort((left, right) => right.price - left.price);
  if (activeSort === 'name') items.sort((left, right) => left.name.localeCompare(right.name));
  $('#menuGrid').innerHTML = items.length ? items.map(productCard).join('') : '<div class="empty-state">No dishes found. Try another search.</div>';
  applyTranslations();
}

function productModal(id) {
  const item = menu.find(menuItem => menuItem.id === id);
  if (!item) return;
  openModal(`<h2 id="modalTitle">${escapeHTML(item.name)}</h2>
    ${item.image ? `<img class="product-detail-image" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}">` : ''}
    <p class="modal-intro">${escapeHTML(item.desc)}</p>
    ${item.ingredients?.length ? `<p class="hint"><b>Ingredients:</b> ${item.ingredients.map(escapeHTML).join(', ')}</p>` : ''}
    ${item.prepTime ? `<p class="hint">Estimated preparation: ${item.prepTime} minutes</p>` : ''}
    ${item.available === false ? '<p class="form-error">This item is currently unavailable.</p>' : `
      <form id="productForm" data-product-id="${item.id}">
        ${item.extras?.length ? `<fieldset class="extras-list"><legend>Optional extras</legend>${item.extras.map((extra, index) =>
          `<label><input type="checkbox" name="extra" value="${escapeHTML(extra.name)}" id="extra-${index}"> ${escapeHTML(extra.name)} <span>+${money(extra.price)}</span></label>`
        ).join('')}</fieldset>` : ''}
        <div class="field"><label for="itemInstructions">Special instructions</label><textarea id="itemInstructions" maxlength="250" placeholder="Any preferences for this dish?"></textarea></div>
        <div class="total-row"><span>From</span><b>${money(item.price)}</b></div>
        <button class="button button-dark wide" type="submit">Add to cart</button>
      </form>`}`);
}

function addItem(id, extras = [], instructions = '') {
  const key = JSON.stringify({ id, extras: [...extras].sort(), instructions: instructions.trim() });
  if ((cart[key] || 0) >= 99) {
    toast('Maximum quantity per dish is 99.');
    return false;
  }
  cart[key] = (cart[key] || 0) + 1;
  saveCart();
  return true;
}

function changeProductQuantity(id, delta) {
  if (delta > 0) return addItem(id);
  const entry = cartEntries().find(cartEntry => cartEntry.item.id === id);
  if (!entry) return false;
  cart[entry.key] -= 1;
  if (cart[entry.key] <= 0) delete cart[entry.key];
  saveCart();
  return true;
}

function openModal(html) {
  clearInterval(customerOrdersRefreshTimer);
  customerOrdersRefreshTimer = null;
  if (addressMap) {
    addressMap.remove();
    addressMap = null;
    addressMarker = null;
  }
  $('#modalContent').innerHTML = html;
  $('#modalBackdrop').classList.remove('hidden');
  $('#floatingCartBar').hidden = true;
  document.body.style.overflow = 'hidden';
  applyTranslations();
}

function closeModal() {
  $('#modalBackdrop').classList.add('hidden');
  document.body.style.overflow = '';
  renderCartCount();
}

function openCustomerMenu() {
  $('#menuScrim').hidden = false;
  requestAnimationFrame(() => $('#menuScrim').classList.add('is-visible'));
  $('#customerMenu').classList.add('is-open');
  $('#customerMenu').setAttribute('aria-hidden', 'false');
  $('#customerMenu').inert = false;
  $('#menuTrigger').setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  requestAnimationFrame(() => $('#menuClose').focus());
}

function closeCustomerMenu(returnFocus = true) {
  $('#menuScrim').classList.remove('is-visible');
  $('#customerMenu').classList.remove('is-open');
  $('#customerMenu').setAttribute('aria-hidden', 'true');
  $('#customerMenu').inert = true;
  $('#menuTrigger').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  window.setTimeout(() => {
    if (!$('#customerMenu').classList.contains('is-open')) $('#menuScrim').hidden = true;
  }, 240);
  if (returnFocus) $('#menuTrigger').focus();
}

function cartSelection(key) {
  try {
    const selection = JSON.parse(key);
    if (selection && typeof selection === 'object' && !Array.isArray(selection)) return selection;
  } catch {
    // Older carts used the menu ID itself as the storage key.
  }
  return { id: Number(key), extras: [], instructions: '' };
}

function cartEntries() {
  return Object.entries(cart)
    .map(([key, quantity]) => {
      const selection = cartSelection(key);
      const item = menu.find(menuItem => menuItem.id === Number(selection.id));
      const extras = Array.isArray(selection.extras) ? selection.extras
        .map(name => item?.extras?.find(extra => extra.name === name)).filter(Boolean) : [];
      return { key, item, extras, instructions: selection.instructions || '', quantity };
    })
    .filter(entry => entry.item && entry.item.available !== false && Number.isSafeInteger(entry.quantity) && entry.quantity > 0);
}

function orderProgressMarkup(order) {
  const deliveryType = order.deliveryType || order.orderType;
  const stages = [
    { label: 'Order Received', statuses: ['Pending approval', 'Confirmed', 'Preparing', 'Ready', 'Assigned', 'Picked Up', 'Out for delivery', 'Delivery problem', 'Delivered', 'Collected', 'Served', 'Completed'] },
    { label: 'Preparing', statuses: ['Preparing', 'Ready', 'Assigned', 'Picked Up', 'Out for delivery', 'Delivery problem', 'Delivered', 'Collected', 'Served', 'Completed'] },
    {
      label: deliveryType === 'delivery' ? 'Out for Delivery' : deliveryType === 'pickup' ? 'Ready for Takeaway' : 'Ready',
      statuses: deliveryType === 'delivery'
        ? ['Out for delivery', 'Delivered']
        : deliveryType === 'pickup' ? ['Collected'] : ['Served', 'Completed']
    }
  ];
  const knownStatuses = [...(order.history || []).map(entry => entry.status), order.status];
  const completedOrder = ['Delivered', 'Collected', 'Served', 'Completed'].includes(order.status);
  const cancelled = order.status === 'Cancelled';
  const currentStep = completedOrder ? stages.length : cancelled
    ? Math.min(2, Math.max(0, stages.findIndex(stage => !stage.statuses.some(status => knownStatuses.includes(status)))))
    : order.status === 'Pending approval' ? 0
      : ['Confirmed', 'Preparing'].includes(order.status) ? 1 : 2;
  return `<ol class="order-progress" aria-label="Order progress">${stages.map((stage, index) => {
    const complete = completedOrder || (index < currentStep && stage.statuses.some(status => knownStatuses.includes(status)));
    const current = !completedOrder && !cancelled && index === currentStep;
    return `<li class="${complete ? 'is-complete' : ''}${current ? ' is-current' : ''}"${current ? ' aria-current="step"' : ''}><span class="order-progress-marker" aria-hidden="true">${complete ? '✓' : index + 1}</span><span>${escapeHTML(localized(stage.label))}</span></li>`;
  }).join('')}</ol>${cancelled ? '<p class="order-cancelled-note">This order was cancelled.</p>' : ''}`;
}

function renderCustomerOrderCard(order) {
  const destination = order.deliveryType === 'pickup'
    ? localized('Pickup / Takeaway')
    : order.deliveryType === 'dine-in'
      ? `${localized('Dine-in')} · ${localized('Table')} ${escapeHTML(order.tableNumber || '')}`
      : localized('Delivery');
  const items = (order.items || []).map(item => `${item.quantity}× ${escapeHTML(item.name)}`).join(', ');
  return `<article class="order-card">
    <div class="dashboard-top"><h3>${escapeHTML(order.id)}</h3><span class="status-pill">${escapeHTML(localized(order.status))}</span></div>
    <p>${new Date(order.createdAt).toLocaleString()} · ${money(order.total)}</p>
    <p>${escapeHTML(destination)}</p>
    <p>${items}</p>
    ${orderProgressMarkup(order)}
    <button class="button button-outline" type="button" data-reorder="${escapeHTML(order.id)}" data-i18n>Order again</button>
  </article>`;
}

function reorderOrder(order) {
  let added = 0;
  let unavailable = false;
  for (const line of order.items || []) {
    const item = menu.find(menuItem => menuItem.id === Number(line.id));
    if (!item || item.available === false) {
      unavailable = true;
      continue;
    }
    const requestedExtras = (line.extras || []).map(extra => typeof extra === 'string' ? extra : extra.name);
    const extras = requestedExtras.filter(name => item.extras?.some(extra => extra.name === name)).sort();
    if (extras.length !== requestedExtras.length) unavailable = true;
    const quantity = Number(line.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) continue;
    const instructions = String(line.instructions || '').trim();
    const key = JSON.stringify({ id: item.id, extras, instructions });
    const currentQuantity = Number(cart[key]) || 0;
    const nextQuantity = Math.min(99, currentQuantity + quantity);
    if (nextQuantity < currentQuantity + quantity) unavailable = true;
    added += nextQuantity - currentQuantity;
    if (nextQuantity) cart[key] = nextQuantity;
  }
  if (added) saveCart();
  toast(added
    ? `${added} ${localized(added === 1 ? 'item added to your cart.' : 'items added to your cart.')}${unavailable ? ` ${localized('Some items or options are no longer available.')}` : ''}`
    : localized('No available items from this order could be added.'));
}

function renderAccountEntry(account) {
  customerAccount = account;
  $('#accountLabel').textContent = account?.name || localized('Sign in');
  $('#accountBtn').setAttribute('aria-label', account ? `${localized('Your account')}: ${account.name}` : localized('Sign in'));
}

function signInModal(mode = 'login') {
  const registering = mode === 'register';
  openModal(`<h2 id="modalTitle" data-i18n>${registering ? 'Create your customer account' : 'Sign in to your account'}</h2>
    <p class="modal-intro" data-i18n>Save your delivery addresses and see your order history securely.</p>
    <form id="customerAuthForm" data-mode="${registering ? 'register' : 'login'}">
      ${registering ? `<div class="field"><label for="accountName" data-i18n>Full name</label><input id="accountName" name="name" required maxlength="100" autocomplete="name"></div>
      <div class="field"><label for="accountPhone" data-i18n>Phone number</label><input id="accountPhone" name="phone" type="tel" required maxlength="40" autocomplete="tel"></div>` : ''}
      <div class="field"><label for="accountEmail" data-i18n>Email</label><input id="accountEmail" name="email" type="email" required maxlength="254" autocomplete="email"></div>
      <div class="field"><label for="accountPassword" data-i18n>Password</label><div class="password-input"><input id="accountPassword" name="password" type="password" required minlength="10" maxlength="200" autocomplete="${registering ? 'new-password' : 'current-password'}"><button type="button" data-password-toggle="accountPassword" aria-label="${escapeHTML(localized('Show'))} ${escapeHTML(localized('Password'))}" aria-pressed="false">${escapeHTML(localized('Show'))}</button></div></div>
      ${registering ? `<div class="field"><label for="accountPasswordConfirm" data-i18n>Confirm password</label><div class="password-input"><input id="accountPasswordConfirm" name="passwordConfirm" type="password" required minlength="10" maxlength="200" autocomplete="new-password"><button type="button" data-password-toggle="accountPasswordConfirm" aria-label="${escapeHTML(localized('Show'))} ${escapeHTML(localized('Password'))}" aria-pressed="false">${escapeHTML(localized('Show'))}</button></div></div>` : ''}
      <button class="button button-dark wide" type="submit" data-i18n>${registering ? 'Create account' : 'Sign in'}</button>
      <p id="customerAuthError" class="form-error" role="alert"></p>
    </form>
    <button class="text-link account-mode-toggle" type="button" data-account-mode="${registering ? 'login' : 'register'}">${registering ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>`);
}

async function refreshCustomerAccount() {
  const session = await api('/api/customer/session');
  renderAccountEntry(session.customer);
  if (!session.authenticated) {
    customerAccount = null;
    return null;
  }
  const deviceFavorites = [...favoriteIds].filter(id => menu.some(item => item.id === id));
  customerAccount = await api('/api/customer/account');
  favoriteIds = new Set([...(customerAccount.favorites || []), ...deviceFavorites]);
  const favoriteResult = await api('/api/customer/favorites', {
    method: 'PUT',
    body: JSON.stringify({ ids: [...favoriteIds] })
  });
  favoriteIds = new Set(favoriteResult.favorites);
  customerAccount.favorites = favoriteResult.favorites;
  localStorage.setItem('dar_favorites', JSON.stringify([...favoriteIds]));
  renderAccountEntry(customerAccount);
  return customerAccount;
}

function renderAccountModal() {
  if (!customerAccount) return signInModal();
  const addresses = customerAccount.addresses || [];
  const orders = customerAccount.orders || [];
  customerOrdersById = new Map(orders.map(order => [order.id, order]));
  openModal(`<div class="account-heading"><div><span class="eyebrow" data-i18n>Your account</span><h2 id="modalTitle">${escapeHTML(customerAccount.name)}</h2></div><button class="button button-outline" type="button" id="customerLogoutBtn" data-i18n>Sign out</button></div>
    <form id="accountProfileForm" class="account-profile-form">
      <div class="field"><label for="profileName" data-i18n>Full name</label><input id="profileName" name="name" required maxlength="100" value="${escapeHTML(customerAccount.name)}"></div>
      <div class="field"><label for="profilePhone" data-i18n>Phone number</label><input id="profilePhone" name="phone" type="tel" required maxlength="40" value="${escapeHTML(customerAccount.phone)}"></div>
      <div class="field"><label for="profileEmail" data-i18n>Email</label><input id="profileEmail" name="email" type="email" required maxlength="254" value="${escapeHTML(customerAccount.email)}"></div>
      <button class="button button-dark" type="submit" data-i18n>Save profile</button><p id="profileMessage" role="status"></p>
    </form>
    <div class="account-section-heading"><h3 data-i18n>My Addresses</h3><button class="button button-dark" type="button" id="addAddressBtn" data-i18n>Add address</button></div>
    <div class="saved-address-list">${addresses.length ? addresses.map(address => `<article class="saved-address-card"><div class="dashboard-top"><b>${escapeHTML(address.label)}${address.isDefault ? ` · ${escapeHTML(localized('Default'))}` : ''}</b>${address.isDefault ? '' : `<button type="button" class="text-link" data-address-default="${escapeHTML(address.id)}" data-i18n>Make default</button>`}</div><p>${escapeHTML([address.building, address.street, address.city].filter(Boolean).join(', '))}${address.unit ? ` · ${escapeHTML(address.unit)}` : ''}</p>${address.notes ? `<small>${escapeHTML(address.notes)}</small>` : ''}<div class="admin-item-actions"><button class="button button-outline" type="button" data-address-edit="${escapeHTML(address.id)}" data-i18n>Edit</button><button class="button button-outline" type="button" data-address-delete="${escapeHTML(address.id)}" data-i18n>Delete</button></div></article>`).join('') : `<p class="empty-state" data-i18n>No saved addresses yet. Add one with a map pin to use it at checkout.</p>`}</div>
    <div class="account-section-heading"><h3 data-i18n>My Orders</h3></div>
    <div class="orders-list">${orders.length ? orders.slice(0, 10).map(renderCustomerOrderCard).join('') : `<p class="empty-state" data-i18n>No orders have been placed from this account yet.</p>`}</div>`);
}

async function accountModal() {
  try {
    await refreshCustomerAccount();
    if (customerAccount) customerAccount.orders = await api('/api/customer/orders');
    renderAccountModal();
  } catch (error) {
    openModal(`<h2 id="modalTitle" data-i18n>Your account</h2><p class="form-error" role="alert">${escapeHTML(error.message)}</p>`);
  }
}

function addressFormModal(address = {}) {
  const isEditing = Boolean(address.id);
  openModal(`<h2 id="modalTitle" data-i18n>${isEditing ? 'Edit address' : 'Add an address'}</h2>
    <p class="modal-intro" data-i18n>Set a map pin for this delivery destination. Location access is optional and used only if you request it.</p>
    <form id="savedAddressForm" data-address-id="${escapeHTML(address.id || '')}">
      <div class="field"><label for="addressLabel" data-i18n>Address label</label><select id="addressLabel" name="label"><option ${address.label === 'Home' ? 'selected' : ''}>Home</option><option ${address.label === 'Work' ? 'selected' : ''}>Work</option><option ${address.label === 'Other' ? 'selected' : ''}>Other</option></select></div>
      <div class="field"><label for="savedCity" data-i18n>City</label><input id="savedCity" name="city" required maxlength="100" value="${escapeHTML(address.city || '')}"></div>
      <div class="field"><label for="savedStreet" data-i18n>Street / area</label><input id="savedStreet" name="street" required maxlength="150" value="${escapeHTML(address.street || address.mapAddress || '')}"></div>
      <div class="field"><label for="savedBuilding" data-i18n>Building / house</label><input id="savedBuilding" name="building" required maxlength="100" value="${escapeHTML(address.building || '')}"></div>
      <div class="field"><label for="savedUnit" data-i18n>Apartment / floor</label><input id="savedUnit" name="unit" maxlength="100" value="${escapeHTML(address.unit || '')}"></div>
      <div class="field"><label for="savedNotes" data-i18n>Delivery instructions</label><textarea id="savedNotes" name="notes" maxlength="500">${escapeHTML(address.notes || '')}</textarea></div>
      <input type="hidden" name="latitude" value="${escapeHTML(address.latitude ?? '')}">
      <input type="hidden" name="longitude" value="${escapeHTML(address.longitude ?? '')}">
      <input type="hidden" name="mapAddress" value="${escapeHTML(address.mapAddress || '')}">
      <p id="selectedMapPin" class="hint" data-latitude="${escapeHTML(address.latitude ?? '')}" data-longitude="${escapeHTML(address.longitude ?? '')}">${address.latitude != null ? `${escapeHTML(address.latitude)}, ${escapeHTML(address.longitude)} · ${escapeHTML(address.mapAddress || localized('Pinned location'))}` : localized('Choose a map pin before saving this address.')}</p>
      <button class="button button-outline wide" type="button" id="openAddressMapBtn" data-i18n>Choose location on map</button>
      <label class="availability-toggle"><input id="addressDefault" type="checkbox" name="isDefault" ${address.isDefault || !customerAccount?.addresses?.length ? 'checked' : ''}> <span data-i18n>Make this my default address</span></label>
      <button class="button button-dark wide" type="submit" data-i18n>Save address</button><p id="addressError" class="form-error" role="alert"></p>
    </form>`);
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        leafletPromise = null;
        reject(new Error('The map library could not be loaded. Check your internet connection and try again.'));
      };
      document.head.append(script);
    });
  }
  return leafletPromise;
}

async function openAddressMap(address, values) {
  openModal(`<h2 id="modalTitle" data-i18n>Choose delivery location</h2>
    <p class="hint" data-i18n>Map tiles and address searches use OpenStreetMap services. GPS is optional and runs only after you request it.</p>
    <div class="map-search-row"><input id="mapSearchInput" type="search" placeholder="Search an address or place" aria-label="Search an address or place"><button class="button button-outline" id="mapSearchBtn" type="button" data-i18n>Search</button><button class="button button-outline" id="useMyLocationBtn" type="button" data-i18n>Use my location</button></div>
    <p id="mapError" class="form-error" role="alert"></p><div id="addressMap" class="address-map" role="application" aria-label="Map for choosing delivery destination"></div>
    <p id="mapLocationStatus" class="hint" data-i18n>Tap the map to place the delivery pin.</p>
    <button class="button button-dark wide" id="confirmMapPinBtn" type="button" data-i18n>Confirm map location</button>`);
  try {
    const L = await loadLeaflet();
    if (!$('#addressMap')) return;
    addressMap?.remove();
    addressMarker = null;
    const initial = address.latitude != null ? [Number(address.latitude), Number(address.longitude)] : [36.1911, 44.0092];
    addressMap = L.map('addressMap').setView(initial, address.latitude != null ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(addressMap);
    const setPin = (latlng, readable = '') => {
      if (addressMarker) {
        addressMarker.setLatLng(latlng);
      } else {
        addressMarker = L.marker(latlng, { draggable: true }).addTo(addressMap);
        addressMarker.on('dragend', event => setPin(event.target.getLatLng()));
      }
      addressMarker.dragging.enable();
      $('#mapLocationStatus').textContent = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}${readable ? ` · ${readable}` : ''}`;
      $('#mapLocationStatus').dataset.address = readable;
    };
    addressMap.on('click', event => setPin(event.latlng));
    if (address.latitude != null) setPin({ lat: initial[0], lng: initial[1] }, address.mapAddress || '');
    const search = async () => {
      const query = $('#mapSearchInput').value.trim();
      if (query.length < 3) return $('#mapError').textContent = localized('Enter at least 3 characters to search.');
      const button = $('#mapSearchBtn');
      button.disabled = true;
      $('#mapError').textContent = '';
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('OpenStreetMap address search is unavailable right now.');
        const results = await response.json();
        if (!results.length) throw new Error('No matching places were found. Move the map pin manually instead.');
        const result = results[0];
        const latlng = { lat: Number(result.lat), lng: Number(result.lon) };
        addressMap.setView(latlng, 16);
        setPin(latlng, result.display_name);
      } catch (error) {
        $('#mapError').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    $('#mapSearchBtn').addEventListener('click', search);
    $('#mapSearchInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        search();
      }
    });
    $('#useMyLocationBtn').addEventListener('click', () => {
      const button = $('#useMyLocationBtn');
      if (!navigator.geolocation) {
        $('#mapError').textContent = localized('Location is unavailable in this browser. Search or move the map pin instead.');
        return;
      }
      button.disabled = true;
      navigator.geolocation.getCurrentPosition(position => {
        const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
        addressMap.setView(latlng, 17);
        setPin(latlng);
        button.disabled = false;
      }, error => {
        $('#mapError').textContent = error.code === error.PERMISSION_DENIED
          ? localized('Location permission was denied. Search for an address or move the pin manually.')
          : localized('Could not determine your location. Search for an address or move the pin manually.');
        button.disabled = false;
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });
    $('#confirmMapPinBtn').addEventListener('click', () => {
      if (!addressMarker) {
        $('#mapError').textContent = localized('Choose a location on the map before confirming.');
        return;
      }
      const latlng = addressMarker.getLatLng();
      const updated = {
        ...values,
        latitude: latlng.lat,
        longitude: latlng.lng,
        mapAddress: $('#mapLocationStatus').dataset.address || ''
      };
      addressMap.remove();
      addressMap = null;
      addressMarker = null;
      addressFormModal(updated);
    });
    setTimeout(() => addressMap.invalidateSize(), 80);
  } catch (error) {
    if ($('#mapError')) $('#mapError').textContent = error.message;
  }
}

function formAddress(form) {
  const data = new FormData(form);
  if (!String(data.get('latitude')).trim() || !String(data.get('longitude')).trim()) {
    throw new Error(localized('Choose a map pin before saving this address.'));
  }
  return {
    label: data.get('label'),
    city: String(data.get('city')).trim(),
    street: String(data.get('street')).trim(),
    building: String(data.get('building')).trim(),
    unit: String(data.get('unit')).trim(),
    notes: String(data.get('notes')).trim(),
    latitude: Number(data.get('latitude')),
    longitude: Number(data.get('longitude')),
    mapAddress: String(data.get('mapAddress')).trim(),
    isDefault: data.get('isDefault') === 'on'
  };
}

function formAddressDraft(form) {
  const data = new FormData(form);
  return {
    id: form.dataset.addressId || '',
    label: data.get('label'),
    city: String(data.get('city') || '').trim(),
    street: String(data.get('street') || '').trim(),
    building: String(data.get('building') || '').trim(),
    unit: String(data.get('unit') || '').trim(),
    notes: String(data.get('notes') || '').trim(),
    latitude: data.get('latitude') ? Number(data.get('latitude')) : null,
    longitude: data.get('longitude') ? Number(data.get('longitude')) : null,
    mapAddress: String(data.get('mapAddress') || '').trim(),
    isDefault: data.get('isDefault') === 'on'
  };
}

function cartModal() {
  const entries = cartEntries();
  const subtotal = entries.reduce((sum, entry) => sum + (entry.item.price + entry.extras.reduce((total, extra) => total + extra.price, 0)) * entry.quantity, 0);
  openModal(`<h2 id="modalTitle">Your cart</h2>
    <p class="modal-intro">A few good things are on their way.</p>
    ${entries.length ? entries.map(({ item, quantity, extras, instructions, key }) => `
      <div class="cart-line"><div><b>${escapeHTML(item.name)}</b><small>${money(item.price + extras.reduce((total, extra) => total + extra.price, 0))} each</small>
        ${extras.length ? `<small>Extras: ${extras.map(extra => escapeHTML(extra.name)).join(', ')}</small>` : ''}
        ${instructions ? `<small>Note: ${escapeHTML(instructions)}</small>` : ''}</div>
        <div class="qty-controls"><button data-qty="${encodeURIComponent(key)}" data-delta="-1" aria-label="Remove one">−</button>
        <b>${quantity}</b><button data-qty="${encodeURIComponent(key)}" data-delta="1" aria-label="Add one">+</button></div>
      </div>`).join('') : '<div class="no-orders">Your cart is empty. Add something delicious from the menu.</div>'}
    <div class="total-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <button class="button button-dark wide" id="checkoutBtn" ${entries.length ? '' : 'disabled'} data-i18n>Continue to checkout →</button>`);
}

async function checkoutModal() {
  const entries = cartEntries();
  if (!entries.length) return cartModal();
  checkoutAddressFlow = true;
  try {
    const account = await refreshCustomerAccount();
    const options = await api('/api/delivery-options');
    const addresses = account?.addresses || [];
    if (!account && !options.pickupEnabled) return signInModal();
    if (account) customerAccount.addresses = addresses;
    checkoutRequestKey = checkoutRequestKey || crypto.randomUUID();
    const selected = addresses.find(address => address.isDefault) || addresses[0];
    const items = entries.map(({ item, quantity, extras, instructions }) => ({ id: item.id, quantity, extras: extras.map(extra => extra.name), instructions }));
    const initialDeliveryType = account && addresses.length
      ? 'delivery'
      : options.pickupEnabled ? 'pickup' : 'delivery';
    if (initialDeliveryType === 'delivery' && !addresses.length) {
      if (!account) return signInModal();
      checkoutAddressFlow = true;
      return addressFormModal({ label: 'Home', isDefault: true });
    }
    openModal(`<h2 id="modalTitle" data-i18n>Checkout · Step 1 of 2</h2>
      <p class="modal-intro" data-i18n>Select Delivery or Pickup, then review the server-calculated total.</p>
      <form id="checkoutForm" data-pickup-enabled="${options.pickupEnabled}">
        <div class="field"><label for="deliveryType" data-i18n>Order type</label><select id="deliveryType" name="deliveryType">${account ? `<option value="delivery" ${initialDeliveryType === 'delivery' ? 'selected' : ''} data-i18n>Delivery</option>` : ''}${options.pickupEnabled ? `<option value="pickup" ${initialDeliveryType === 'pickup' ? 'selected' : ''} data-i18n>Pickup / Takeaway</option>` : ''}</select></div>
        <div class="field" id="checkoutAddressField"><label for="addressId" data-i18n>Delivery address</label><select id="addressId" name="addressId">${addresses.map(address => `<option value="${escapeHTML(address.id)}" ${address.id === selected?.id ? 'selected' : ''}>${escapeHTML(address.label)} · ${escapeHTML(address.street)}, ${escapeHTML(address.city)}${address.isDefault ? ` · ${escapeHTML(localized('Default'))}` : ''}</option>`).join('')}</select></div>
        <div class="field" id="checkoutAddressSummary"></div>
        <button class="button button-outline wide" type="button" id="checkoutAddAddressBtn" data-i18n>Add a different address</button>
        <div class="checkout-lines">${entries.map(({ item, quantity, extras }) => `<div class="cart-line"><span>${quantity}× ${escapeHTML(item.name)}${extras.length ? ` (${extras.map(extra => escapeHTML(extra.name)).join(', ')})` : ''}</span><b>${money((item.price + extras.reduce((sum, extra) => sum + extra.price, 0)) * quantity)}</b></div>`).join('')}</div>
        <p class="hint checkout-policy" data-i18n>Takeout &amp; Delivery Only: All orders are prepared for takeaway or delivery. Dine-in is not available.</p>
        <div class="total-row"><span data-i18n>Subtotal</span><span id="checkoutSubtotal">—</span></div>
        <div class="total-row"><span data-i18n>Delivery fee</span><span id="checkoutFee">—</span></div>
        <div class="total-row"><span data-i18n>Discount</span><span id="checkoutDiscount">${money(0)}</span></div>
        <div class="field"><label for="couponCode" data-i18n>Coupon code</label><div class="admin-form-actions"><input id="couponCode" name="couponCode" maxlength="32" autocomplete="off"><button class="button button-outline" type="button" id="applyCouponBtn" data-i18n>Apply</button></div></div>
        <p id="couponMessage" class="hint" role="status"></p>
        <div class="total-row checkout-final-total"><b data-i18n>Final total</b><b id="checkoutTotal">—</b></div>
        <div class="field"><label for="paymentMethod" data-i18n>Cash Payment Only</label><select id="paymentMethod" name="payment"></select><small class="hint" data-i18n>Cash payments only. All orders are strictly for delivery or takeaway — no dine-in available.</small></div>
        <p id="checkoutError" class="form-error" role="alert"></p>
        <button class="button button-dark wide" type="submit" id="placeOrderBtn" data-i18n>Review and place order</button>
        <p class="hint" data-i18n>Your order is created only when you tap Place Order. This website does not process card payments.</p>
      </form>`);
    if (selected) renderCheckoutAddress(selected);
    checkoutAddressFlow = false;
    await updateCheckoutQuote(items);
  } catch (error) {
    if (error.status === 401) return signInModal();
    checkoutAddressFlow = false;
    openModal(`<h2 id="modalTitle" data-i18n>Checkout</h2><p class="form-error" role="alert">${escapeHTML(error.message)}</p>`);
  }
}

function renderCheckoutAddress(address) {
  $('#checkoutAddressSummary').innerHTML = address
    ? `<p><b>${escapeHTML(address.label)}</b> · ${escapeHTML([address.building, address.street, address.city].filter(Boolean).join(', '))}</p>${address.unit ? `<p>${escapeHTML(address.unit)}</p>` : ''}${address.notes ? `<p>${escapeHTML(address.notes)}</p>` : ''}<p class="hint">${address.latitude != null ? `${escapeHTML(address.latitude)}, ${escapeHTML(address.longitude)}` : escapeHTML(localized('Map pin not saved'))}</p>`
    : '';
}

async function updateCheckoutQuote(items = cartEntries().map(({ item, quantity, extras, instructions }) => ({ id: item.id, quantity, extras: extras.map(extra => extra.name), instructions }))) {
  const form = $('#checkoutForm');
  if (!form) return;
  const deliveryType = $('#deliveryType').value;
  const addressField = $('#checkoutAddressField');
  const addressId = deliveryType === 'delivery' ? $('#addressId').value : '';
  const couponCode = $('#couponCode').value.trim().toUpperCase();
  const selectedAddress = customerAccount?.addresses?.find(address => address.id === addressId);
  addressField.hidden = deliveryType !== 'delivery';
  $('#checkoutAddressSummary').hidden = deliveryType !== 'delivery';
  $('#checkoutAddAddressBtn').hidden = deliveryType !== 'delivery';
  $('#paymentMethod').innerHTML = `
    <option value="Cash on delivery"${deliveryType === 'delivery' ? ' selected' : ''}${deliveryType !== 'delivery' ? ' disabled' : ''}>${escapeHTML(localized('Cash on Delivery'))}</option>
    <option value="Cash at pickup"${deliveryType === 'pickup' ? ' selected' : ''}${deliveryType !== 'pickup' ? ' disabled' : ''}>${escapeHTML(localized('Cash at Store (Takeaway)'))}</option>`;
  renderCheckoutAddress(deliveryType === 'delivery' ? selectedAddress : null);
  const button = $('#placeOrderBtn');
  button.disabled = true;
  $('#checkoutError').textContent = '';
  try {
    const quote = await api('/api/checkout/quote', {
      method: 'POST',
      body: JSON.stringify({ items, deliveryType, addressId, couponCode })
    });
    $('#checkoutSubtotal').textContent = money(quote.subtotal);
    $('#checkoutFee').textContent = money(quote.deliveryFee);
    $('#checkoutDiscount').textContent = money(quote.discount);
    $('#checkoutTotal').textContent = money(quote.total);
    $('#couponMessage').textContent = quote.couponCode
      ? `${localized('Coupon')} ${quote.couponCode} ${localized('applied')} · ${money(quote.discount)} ${localized('off')}`
      : '';
    button.dataset.total = String(quote.total);
    button.dataset.quotedType = deliveryType;
    button.dataset.quotedAddress = addressId;
    button.dataset.quotedCoupon = couponCode;
    button.disabled = false;
  } catch (error) {
    $('#checkoutError').textContent = error.message;
    $('#couponMessage').textContent = '';
    $('#checkoutSubtotal').textContent = '—';
    $('#checkoutFee').textContent = '—';
    $('#checkoutTotal').textContent = '—';
  }
}

async function placeOrder(form) {
  const button = form.querySelector('[type="submit"]');
  const deliveryType = $('#deliveryType').value;
  const addressId = deliveryType === 'delivery' ? $('#addressId').value : '';
  const payment = deliveryType === 'delivery' ? 'Cash on delivery' : 'Cash at pickup';
  $('#paymentMethod').value = payment;
  const couponCode = $('#couponCode').value.trim().toUpperCase();
  const currentEntries = cartEntries().map(({ item, quantity, extras, instructions }) => ({
    id: item.id, quantity, extras: extras.map(extra => extra.name), instructions
  }));
  button.disabled = true;
  try {
    if (button.dataset.quotedType !== deliveryType || button.dataset.quotedAddress !== addressId || button.dataset.quotedCoupon !== couponCode) {
      await updateCheckoutQuote(currentEntries);
      if (button.disabled) return;
    }
    const result = await api('/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': checkoutRequestKey },
      body: JSON.stringify({
        deliveryType,
        addressId,
        couponCode,
        payment,
        items: currentEntries
      })
    });
    checkoutRequestKey = null;
    orderTrackers.unshift({ id: result.order.id, token: result.trackingToken });
    localStorage.setItem('dar_order_trackers', JSON.stringify(orderTrackers));
    cart = {};
    saveCart();
    const order = result.order;
    const configuredSupportPhone = String(siteDesign?.contactPhone || '').trim();
    const supportNumber = configuredSupportPhone.replace(/\D/g, '').replace(/^00/, '');
    const supportLink = /^\s*(?:\+|00)/.test(configuredSupportPhone) && supportNumber.length >= 8
      ? `<a class="button button-outline wide" href="https://wa.me/${encodeURIComponent(supportNumber)}?text=${encodeURIComponent(`Hello, I need help with order ${order.id}.`)}" target="_blank" rel="noopener noreferrer">Contact Support on WhatsApp</a>`
      : '<button class="button button-outline wide" type="button" id="contactSupportBtn">Contact Support</button>';
    openModal(`<h2 id="modalTitle">Order received!</h2>
      <p class="modal-intro">The restaurant has received your order.</p>
      <div class="order-card"><h3>Order number: ${escapeHTML(order.id)}</h3><p>Total: <b>${money(order.total)}</b></p>
        <p>${order.deliveryType === 'pickup' ? escapeHTML(localized('Pickup / Takeaway')) : order.deliveryType === 'dine-in' ? `${escapeHTML(localized('Dine-in'))} · ${escapeHTML(localized('Table'))} ${escapeHTML(order.tableNumber)}` : `${escapeHTML(order.address.label)}: ${escapeHTML(order.address.street)}, ${escapeHTML(order.address.building)}, ${escapeHTML(order.address.city)}`}</p>
        <p>Payment: ${escapeHTML(order.payment)} · ${escapeHTML(order.paymentStatus)}${result.paymentConfirmed ? '' : ` · ${escapeHTML(localized('Payment has not been confirmed.'))}`}</p>
        <p>Status: <span class="status-pill">${escapeHTML(order.status)}</span></p>
        ${orderProgressMarkup(order)}
        <div class="field tracking-code-field"><label for="trackingCode">Private tracking code</label>
          <input id="trackingCode" value="${escapeHTML(result.trackingToken)}" readonly dir="ltr" aria-describedby="trackingCodeHint">
          <span class="hint" id="trackingCodeHint">Save this private tracking code to check your order on another device. Keep it private.</span>
        </div></div>
      ${supportLink}
      <button class="button button-dark wide" id="showOrdersBtn">View my orders</button>`);
  } catch (error) {
    form.querySelector('#checkoutError').textContent = error.message;
    if (error.orderId) {
      button.disabled = true;
      checkoutRequestKey = null;
    } else button.disabled = false;
  }
}

async function customerOrdersModal(silentRefresh = false) {
  clearInterval(customerOrdersRefreshTimer);
  customerOrdersRefreshTimer = null;
  if (!silentRefresh) {
    openModal('<div id="customerOrdersView"><h2 id="modalTitle">My orders</h2><p class="modal-intro">Loading your order history…</p></div>');
  }
  try {
    const session = await api('/api/customer/session');
    const accountOrders = session.authenticated ? await api('/api/customer/orders') : [];
    const accountOrderIds = new Set(accountOrders.map(order => order.id));
    const trackedResults = await Promise.all(orderTrackers.filter(tracker => !accountOrderIds.has(tracker.id)).map(async tracker => {
      try {
        const order = await api(`/api/orders/${encodeURIComponent(tracker.id)}`, {
          headers: { 'X-Order-Token': tracker.token }
        });
        return { order };
      } catch (error) {
        return { error: error.message, id: tracker.id };
      }
    }));
    const activeModal = !$('#modalBackdrop').classList.contains('hidden');
    if (!activeModal || !$('#customerOrdersView')) return;
    const orders = [...accountOrders, ...trackedResults.flatMap(result => result.order ? [result.order] : [])];
    customerOrdersById = new Map(orders.map(order => [order.id, order]));
    const failedTrackers = trackedResults.filter(result => result.error);
    const contentScrollTop = $('#modalContent').scrollTop;
    openModal(`<div id="customerOrdersView"><h2 id="modalTitle">My orders</h2>
      <p class="modal-intro">Order status is refreshed from the restaurant.</p>
      <section class="order-lookup" aria-labelledby="orderLookupTitle">
        <h3 id="orderLookupTitle">Track an order securely</h3>
        <p class="hint">Enter the order number and private tracking code from your confirmation.</p>
        <form id="orderLookupForm">
          <div class="field"><label for="lookupOrderId">Order number</label><input id="lookupOrderId" name="orderId" required autocomplete="off" autocapitalize="characters"></div>
          <div class="field"><label for="lookupTrackingToken">Private tracking code</label><input id="lookupTrackingToken" name="trackingToken" required autocomplete="off" autocapitalize="off" spellcheck="false" dir="ltr"></div>
          <button class="button button-dark" type="submit">Find order</button>
          <p class="form-error" id="lookupError" role="alert"></p>
        </form>
      </section>
      ${orders.length ? `<div class="orders-list">${orders.map(renderCustomerOrderCard).join('')}${failedTrackers.map(result => `<article class="order-card"><h3>${escapeHTML(result.id)}</h3><p>${escapeHTML(result.error)}</p></article>`).join('')}</div>`
        : '<div class="no-orders">No orders yet. Your first favourite is waiting in the menu.</div>'}</div>`);
    if (silentRefresh) $('#modalContent').scrollTop = contentScrollTop;
    scheduleCustomerOrdersRefresh();
  } catch (error) {
    if (silentRefresh) {
      toast(error.message);
      scheduleCustomerOrdersRefresh();
    } else {
      openModal(`<div id="customerOrdersView"><h2 id="modalTitle">My orders</h2><p class="form-error" role="alert">${escapeHTML(error.message)}</p></div>`);
    }
  }
}

function scheduleCustomerOrdersRefresh() {
  customerOrdersRefreshTimer = setInterval(() => {
    if ($('#modalBackdrop').classList.contains('hidden') || !$('#customerOrdersView')) {
      clearInterval(customerOrdersRefreshTimer);
      customerOrdersRefreshTimer = null;
      return;
    }
    if ($('#orderLookupForm').contains(document.activeElement)) return;
    customerOrdersModal(true);
  }, 15000);
}

async function trackOrder(form) {
  const fields = new FormData(form);
  const id = String(fields.get('orderId')).trim();
  const token = String(fields.get('trackingToken')).trim();
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api(`/api/orders/${encodeURIComponent(id)}`, {
      headers: { 'X-Order-Token': token }
    });
    orderTrackers = orderTrackers.filter(tracker => tracker.id !== id);
    orderTrackers.unshift({ id, token });
    localStorage.setItem('dar_order_trackers', JSON.stringify(orderTrackers));
    await customerOrdersModal();
  } catch (error) {
    form.querySelector('#lookupError').textContent = error.message;
    button.disabled = false;
  }
}

$('#categoryRow').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderMenu();
});
$('#menuGrid').addEventListener('click', event => {
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    event.stopPropagation();
    toggleFavorite(Number(favorite.dataset.favorite));
    return;
  }
  const customizeButton = event.target.closest('[data-product-customize]');
  if (customizeButton) {
    event.stopPropagation();
    productModal(Number(customizeButton.dataset.productCustomize));
    return;
  }
  const removeButton = event.target.closest('[data-cart-remove]');
  const button = event.target.closest('[data-cart-add]');
  const card = event.target.closest('[data-product]');
  if (removeButton) {
    event.stopPropagation();
    changeProductQuantity(Number(removeButton.dataset.cartRemove), -1);
    return;
  }
  if (button) {
    event.stopPropagation();
    if (changeProductQuantity(Number(button.dataset.cartAdd), 1)) showCartButtonFeedback(button);
  } else if (card) productModal(Number(card.dataset.product));
});
$('#featuredGrid').addEventListener('click', event => {
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    event.stopPropagation();
    toggleFavorite(Number(favorite.dataset.favorite));
    return;
  }
  const customizeButton = event.target.closest('[data-product-customize]');
  if (customizeButton) {
    event.stopPropagation();
    productModal(Number(customizeButton.dataset.productCustomize));
    return;
  }
  const removeButton = event.target.closest('[data-cart-remove]');
  const button = event.target.closest('[data-cart-add]');
  const card = event.target.closest('[data-product]');
  if (removeButton) {
    event.stopPropagation();
    changeProductQuantity(Number(removeButton.dataset.cartRemove), -1);
    return;
  }
  if (button) {
    event.stopPropagation();
    if (changeProductQuantity(Number(button.dataset.cartAdd), 1)) showCartButtonFeedback(button);
  } else if (card) productModal(Number(card.dataset.product));
});
$('#searchInput').addEventListener('input', renderMenu);
$('#priceFilter').addEventListener('input', renderMenu);
$('#sortMenu').addEventListener('change', event => {
  activeSort = event.target.value;
  renderMenu();
});
$('#cartBtn').addEventListener('click', cartModal);
$('#bottomCartBtn').addEventListener('click', cartModal);
$('#floatingCartBtn').addEventListener('click', cartModal);
$('#bottomOrdersBtn').addEventListener('click', customerOrdersModal);
$('#bottomFavoritesBtn').addEventListener('click', favoritesModal);
$('#accountBtn').addEventListener('click', accountModal);
$('#menuTrigger').addEventListener('click', openCustomerMenu);
$('#menuClose').addEventListener('click', () => closeCustomerMenu());
$('#menuScrim').addEventListener('click', () => closeCustomerMenu());
document.querySelectorAll('[data-customer-about]').forEach(button => button.addEventListener('click', openAboutModal));
document.querySelectorAll('[data-customer-contact]').forEach(button => button.addEventListener('click', contactModal));
$('#customerMenu').addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (link) closeCustomerMenu(false);
});
$('#ordersMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  customerOrdersModal();
});
$('#settingsToggle').addEventListener('click', () => {
  const button = $('#settingsToggle');
  const submenu = $('#settingsSubmenu');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  submenu.hidden = expanded;
});
$('#languageMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  openLanguageModal();
});
$('#aboutMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  openAboutModal();
});
$('#promotionsMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  $('#offers').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#favoritesMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  favoritesModal();
});
$('#reviewsMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  reviewsModal();
});
$('#rewardsMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  rewardsModal();
});
$('#contactMenuBtn').addEventListener('click', () => {
  closeCustomerMenu(false);
  contactModal();
});
$('#closeModal').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', event => {
  if (event.target === $('#modalBackdrop')) closeModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!$('#modalBackdrop').classList.contains('hidden')) closeModal();
    else if ($('#customerMenu').classList.contains('is-open')) closeCustomerMenu();
  }
});
$('#modalContent').addEventListener('click', event => {
  const passwordToggle = event.target.closest('[data-password-toggle]');
  if (passwordToggle) {
    const input = $(`#${passwordToggle.dataset.passwordToggle}`);
    const showPassword = input.type === 'password';
    input.type = showPassword ? 'text' : 'password';
    passwordToggle.textContent = localized(showPassword ? 'Hide' : 'Show');
    passwordToggle.setAttribute('aria-label', `${localized(showPassword ? 'Hide' : 'Show')} ${localized('Password')}`);
    passwordToggle.setAttribute('aria-pressed', String(showPassword));
    return;
  }
  const reorderButton = event.target.closest('[data-reorder]');
  if (reorderButton) {
    const order = customerOrdersById.get(reorderButton.dataset.reorder);
    if (order) reorderOrder(order);
    return;
  }
  if (event.target.closest('#contactSupportBtn')) {
    contactModal();
    return;
  }
  if (event.target.closest('#applyCouponBtn')) {
    updateCheckoutQuote();
    return;
  }
  const modeToggle = event.target.closest('[data-account-mode]');
  if (modeToggle) {
    signInModal(modeToggle.dataset.accountMode);
    return;
  }
  if (event.target.closest('#customerLogoutBtn')) {
    api('/api/customer/logout', { method: 'POST' }).then(() => {
      customerAccount = null;
      renderAccountEntry(null);
      signInModal();
    }).catch(error => toast(error.message));
    return;
  }
  if (event.target.closest('#addAddressBtn')) {
    addressFormModal({ label: customerAccount?.addresses?.length ? 'Other' : 'Home', isDefault: !customerAccount?.addresses?.length });
    return;
  }
  if (event.target.closest('#openAddressMapBtn')) {
    const form = $('#savedAddressForm');
    const previous = formAddressDraft(form);
    openAddressMap(previous, previous);
    return;
  }
  if (event.target.closest('#checkoutAddAddressBtn')) {
    checkoutAddressFlow = true;
    addressFormModal({ label: 'Other' });
    return;
  }
  if (event.target.closest('#checkoutSignInBtn')) {
    signInModal();
    return;
  }
  const addressEdit = event.target.closest('[data-address-edit]');
  if (addressEdit) {
    const address = customerAccount?.addresses?.find(item => item.id === addressEdit.dataset.addressEdit);
    if (address) addressFormModal(address);
    return;
  }
  const addressDelete = event.target.closest('[data-address-delete]');
  if (addressDelete) {
    addressDelete.disabled = true;
    api(`/api/customer/addresses/${encodeURIComponent(addressDelete.dataset.addressDelete)}`, { method: 'DELETE' })
      .then(accountModal)
      .catch(error => {
        toast(error.message);
        addressDelete.disabled = false;
      });
    return;
  }
  const addressDefault = event.target.closest('[data-address-default]');
  if (addressDefault) {
    api(`/api/customer/addresses/${encodeURIComponent(addressDefault.dataset.addressDefault)}/default`, { method: 'PATCH', body: JSON.stringify({}) })
      .then(accountModal)
      .catch(error => toast(error.message));
    return;
  }
  const languageButton = event.target.closest('[data-language]');
  if (languageButton) {
    setLanguage(languageButton.dataset.language);
    return;
  }
  const quantityButton = event.target.closest('[data-qty]');
  if (quantityButton) {
    const key = decodeURIComponent(quantityButton.dataset.qty);
    const entry = cartEntries().find(cartEntry => cartEntry.key === key);
    if (!entry) return;
    const nextQuantity = cart[key] + Number(quantityButton.dataset.delta);
    if (nextQuantity <= 0) delete cart[key];
    else if (nextQuantity > 99) {
      toast('Maximum quantity per dish is 99.');
      return;
    } else cart[key] = nextQuantity;
    saveCart();
    cartModal();
  } else if (event.target.closest('#checkoutBtn')) {
    checkoutModal();
  } else if (event.target.closest('#showOrdersBtn')) {
    customerOrdersModal();
  }
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    toggleFavorite(Number(favorite.dataset.favorite));
    favoritesModal();
    return;
  }
  const addButton = event.target.closest('[data-cart-add]');
  if (addButton) {
    if (changeProductQuantity(Number(addButton.dataset.cartAdd), 1)) showCartButtonFeedback(addButton);
  } else if (event.target.closest('[data-cart-remove]')) {
    changeProductQuantity(Number(event.target.closest('[data-cart-remove]').dataset.cartRemove), -1);
  } else if (event.target.closest('[data-product-customize]')) {
    productModal(Number(event.target.closest('[data-product-customize]').dataset.productCustomize));
  } else if (event.target.closest('[data-product]')) {
    productModal(Number(event.target.closest('[data-product]').dataset.product));
  }
});
$('#modalContent').addEventListener('change', event => {
  if (event.target.id === 'deliveryType' || event.target.id === 'addressId' || event.target.id === 'tableId') {
    updateCheckoutQuote();
  }
});
$('#modalContent').addEventListener('submit', event => {
  if (event.target.id === 'customerAuthForm') {
    event.preventDefault();
    submitCustomerAuth(event.target);
  } else if (event.target.id === 'accountProfileForm') {
    event.preventDefault();
    saveCustomerProfile(event.target);
  } else if (event.target.id === 'savedAddressForm') {
    event.preventDefault();
    saveCustomerAddress(event.target);
  } else if (event.target.id === 'checkoutForm') {
    event.preventDefault();
    placeOrder(event.target);
  } else if (event.target.id === 'orderLookupForm') {
    event.preventDefault();
    trackOrder(event.target);
  } else if (event.target.id === 'reviewForm') {
    event.preventDefault();
    const form = event.target;
    const fields = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    const message = $('#reviewMessage');
    submit.disabled = true;
    message.textContent = '';
    api('/api/reviews', {
      method: 'POST',
      headers: { 'X-Order-Token': String(fields.get('trackingToken')).trim() },
      body: JSON.stringify({
        orderId: String(fields.get('orderId')).trim(),
        rating: Number(fields.get('rating')),
        displayName: String(fields.get('displayName')).trim(),
        comment: String(fields.get('comment')).trim()
      })
    }).then(async result => {
      message.classList.remove('form-error');
      message.classList.add('form-success');
      message.textContent = result.message;
      form.reset();
    }).catch(error => {
      message.classList.remove('form-success');
      message.classList.add('form-error');
      message.textContent = error.message;
    }).finally(() => {
      submit.disabled = false;
    });

    async function submitCustomerAuth(form) {
      const fields = new FormData(form);
      const registering = form.dataset.mode === 'register';
      const button = form.querySelector('[type="submit"]');
      const errorElement = $('#customerAuthError');
      errorElement.textContent = '';
      if (registering && fields.get('password') !== fields.get('passwordConfirm')) {
        errorElement.textContent = localized('Passwords do not match.');
        return;
      }
      button.disabled = true;
      try {
        const result = await api(`/api/customer/${registering ? 'register' : 'login'}`, {
          method: 'POST',
          body: JSON.stringify({
            name: fields.get('name'),
            phone: fields.get('phone'),
            email: fields.get('email'),
            password: fields.get('password')
          })
        });
        renderAccountEntry(result.customer);
        if (checkoutAddressFlow) {
          checkoutAddressFlow = false;
          return checkoutModal();
        }
        await accountModal();
      } catch (error) {
        errorElement.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    }

    async function saveCustomerProfile(form) {
      const fields = new FormData(form);
      const message = $('#profileMessage');
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      message.textContent = '';
      try {
        const profile = await api('/api/customer/account', {
          method: 'PUT',
          body: JSON.stringify({ name: fields.get('name'), phone: fields.get('phone'), email: fields.get('email') })
        });
        renderAccountEntry(profile);
        message.textContent = localized('Profile saved.');
      } catch (error) {
        message.textContent = error.message;
        message.className = 'form-error';
      } finally {
        button.disabled = false;
      }
    }

    async function saveCustomerAddress(form) {
      const button = form.querySelector('[type="submit"]');
      const errorElement = $('#addressError');
      button.disabled = true;
      errorElement.textContent = '';
      try {
        const address = formAddress(form);
        const id = form.dataset.addressId;
        await api(id ? `/api/customer/addresses/${encodeURIComponent(id)}` : '/api/customer/addresses', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(address)
        });
        customerAccount = await api('/api/customer/account');
        if (checkoutAddressFlow) {
          checkoutAddressFlow = false;
          return checkoutModal();
        }
        renderAccountModal();
      } catch (error) {
        errorElement.textContent = error.message;
        button.disabled = false;
      }
    }
  } else if (event.target.id === 'productForm') {
    event.preventDefault();
    const form = event.target;
    if (addItem(Number(form.dataset.productId), [...form.querySelectorAll('[name="extra"]:checked')].map(input => input.value), $('#itemInstructions').value)) closeModal();
  }
});

async function initialize() {
  document.body.classList.toggle('menu-page', window.location.pathname === '/menu');
  applyTranslations();
  $('#year').textContent = new Date().getFullYear();
  renderCartCount();
  try {
    menu = await api('/api/menu');
    const availableIds = new Set(menu.filter(item => item.available !== false).map(item => item.id));
    cart = Object.fromEntries(Object.entries(cart).filter(([key]) => availableIds.has(Number(cartSelection(key).id))));
    favoriteIds = new Set([...favoriteIds].filter(id => menu.some(item => item.id === id)));
    localStorage.setItem('dar_favorites', JSON.stringify([...favoriteIds]));
    saveCart();
    renderCategories();
    renderMenu();
    renderFeatured();
  } catch (error) {
    $('#menuGrid').innerHTML = `<div class="empty-state" role="alert">Menu could not be loaded: ${escapeHTML(error.message)}</div>`;
    $('#featuredGrid').innerHTML = `<p class="form-error" role="alert">${escapeHTML(error.message)}</p>`;
  }
  try {
    const publishedDesign = await api('/api/design');
    applyDesign(previewDesignOverride || publishedDesign);
  } catch (error) {
    toast(`Website design could not be loaded: ${error.message}`);
  }
  try {
    promotions = await api('/api/promotions');
    renderPromotions();
  } catch (error) {
    $('#offersGrid').innerHTML = `<p class="form-error" role="alert">${escapeHTML(error.message)}</p>`;
  }
  try {
    approvedReviews = await api('/api/reviews');
  } catch (error) {
    toast(`Customer reviews could not be loaded: ${error.message}`);
  }
}

initialize();
setInterval(async () => {
  if (document.visibilityState === 'hidden') return;
  try {
    const [updatedMenu, updatedDesign] = await Promise.all([
      api('/api/menu'),
      api('/api/design')
    ]);
    if (JSON.stringify(updatedMenu) !== JSON.stringify(menu)) {
      menu = updatedMenu;
      const availableIds = new Set(menu.filter(item => item.available !== false).map(item => item.id));
      cart = Object.fromEntries(Object.entries(cart).filter(([key]) => availableIds.has(Number(cartSelection(key).id))));
      saveCart();
      renderCategories();
      renderMenu();
      renderFeatured();
      favoriteIds = new Set([...favoriteIds].filter(id => menu.some(item => item.id === id)));
      localStorage.setItem('dar_favorites', JSON.stringify([...favoriteIds]));
      toast('The restaurant menu has been updated.');
    }
    if (!previewDesignOverride && JSON.stringify(updatedDesign) !== JSON.stringify(siteDesign)) applyDesign(updatedDesign);
    try {
      const [updatedPromotions, updatedReviews] = await Promise.all([
        api('/api/promotions'),
        api('/api/reviews')
      ]);
      if (JSON.stringify(updatedPromotions) !== JSON.stringify(promotions)) {
        promotions = updatedPromotions;
        renderPromotions();
      }
      if (JSON.stringify(updatedReviews) !== JSON.stringify(approvedReviews)) approvedReviews = updatedReviews;
    } catch (error) {
      toast(`Offers or reviews refresh failed: ${error.message}`);
    }
  } catch (error) {
    toast(`Menu refresh failed: ${error.message}`);
  }
}, 30000);
