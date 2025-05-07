// Initialize IndexedDB
let db;
const storeName = 'productsStore';


const request = indexedDB.open('RomoshAlaOpticalDB', 1);

// Create or upgrade DB schema
request.onupgradeneeded = function (e) {
  db = e.target.result;
  if (!db.objectStoreNames.contains(storeName)) {
    const store = db.createObjectStore(storeName, { keyPath: 'id' });
    store.createIndex('name', 'name', { unique: false });
  }
};

// Error handling for IndexedDB opening
request.onerror = function (e) {
  console.error('Error opening IndexedDB:', e.target.error);
};

// Add Product Form and Sale Table Elements
const productForm = document.getElementById('product-form');
const productTableBody = document.querySelector('#product-table tbody');
const salesTableBody = document.querySelector('#sales-table tbody');
const barcodeScanner = document.getElementById('barcode-scanner');
const totalPriceElement = document.getElementById('total-price');

let products = [];


// Function to generate unique numeric barcode (product ID)
function generateUniqueBarcode() {
  const timestamp = Date.now(); // Current timestamp
  const randomNum = Math.floor(Math.random() * 10); // Random 6-digit number
  return timestamp.toString() + randomNum.toString(); // Combine timestamp and random number
}

// Add product to IndexedDB
function addProductToDB(product) {
  const transaction = db.transaction([storeName], "readwrite");
  const store = transaction.objectStore(storeName);

  // Generate unique barcode ID for each product
  const uniqueId = generateUniqueBarcode();
  const productWithId = { ...product, id: uniqueId };

  store.add(productWithId);

  transaction.oncomplete = function () {
    console.log('Product added to the database with barcode ID:', uniqueId);
    renderProducts();
  };

  transaction.onerror = function (event) {
    console.error('Error adding product:', event);
  };
}

// Add product to form submission
productForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('product-name').value;
  const category = document.getElementById('product-category').value;
  const price = parseFloat(document.getElementById('product-price').value);
  const quantity = parseInt(document.getElementById('product-quantity').value);

  const product = { name, category, price, quantity };
  addProductToDB(product); // Save the product to IndexedDB
  productForm.reset();
});

// Render products in admin table from IndexedDB
function renderProducts() {
  const transaction = db.transaction([storeName], "readonly");
  const store = transaction.objectStore(storeName);
  const request = store.getAll(); // Get all products

  request.onsuccess = function () {
    products = request.result;
    productTableBody.innerHTML = ''; // Clear table
    products.forEach((product) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td>${product.price.toFixed(2)}</td>
        <td>${product.quantity}</td>
        <td><svg id="barcode-${product.id}"></svg></td>
        <td>
          <button class="btn btn-danger" onclick="deleteProduct('${product.id}')">Delete</button>
          <button class="btn" onclick="addToSales('${product.id}')">Add to Sale</button>
        </td>
      `;
      productTableBody.appendChild(row);

      // Generate barcode
      JsBarcode(`#barcode-${product.id}`, product.id, {
        format: 'CODE128',
        lineColor: '#000',
        width: 1.5,
        height: 50,
        displayValue: true,
      });
    });
  };

  request.onerror = function (event) {
    console.error('Error fetching products from IndexedDB:', event);
  };
}

// Delete product from IndexedDB
function deleteProduct(id) {
  const transaction = db.transaction([storeName], "readwrite");
  const store = transaction.objectStore(storeName);
  store.delete(id);

  transaction.oncomplete = function () {
    console.log('Product deleted');
    renderProducts(); // Refresh product list
  };

  transaction.onerror = function (event) {
    console.error('Error deleting product:', event);
  };
}

// Handle barcode scanner input
barcodeScanner.addEventListener('input', (e) => {
  const scannedData = e.target.value;
  const product = products.find((p) => p.id === scannedData); // Match product by ID

  if (product) {
    addToSales(product.id);
  } else {
    alert('Product not found!');
  }

  barcodeScanner.value = ''; // Clear scanner input
});

// Add product to sales
function updateStockInDB(productId, quantitySold) {
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);

  const request = store.get(productId);

  request.onsuccess = function () {
    const product = request.result;
    if (product) {
      product.quantity -= quantitySold; // Reduce stock
      if (product.quantity < 0) product.quantity = 0; // Prevent negative stock

      store.put(product); // Update product
      renderProducts(); // Refresh showcase page
    }
  };

  request.onerror = function (event) {
    console.error('Error updating stock:', event);
  };
}



// Modify addToSales to update stock after sale
// Add this function to handle automatic discount application
function applyAutoDiscount() {
  const discountInput = document.getElementById('discount');
  
  // Only apply if no discount exists or it's zero
  if (!discountInput.value || parseFloat(discountInput.value) === 0) {
    discountInput.value = '0.00';
    
    // Trigger the input event to update calculations
    const event = new Event('input', {
      bubbles: true,
      cancelable: true,
    });
    discountInput.dispatchEvent(event);
    
    // Show visual feedback
    flashDiscountInput();
  }
}

// Visual feedback for discount application
function flashDiscountInput() {
  const discountInput = document.getElementById('discount');
  discountInput.style.transition = 'background-color 0.5s ease';
  discountInput.style.backgroundColor = '#e6ffe6';
  
  setTimeout(() => {
    discountInput.style.backgroundColor = '';
    
    // Show notification
    const notification = document.createElement('div');
    notification.textContent = '';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '1000';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s';
      setTimeout(() => document.body.removeChild(notification), 500);
    }, 2000);
  }, 1000);
}

// Modified addToSales function
function addToSales(id) {
  const product = products.find((p) => p.id === id);
  const existingRow = [...salesTableBody.children].find((row) => row.dataset.id == product.id);

  let row;
  if (existingRow) {
    const quantityInput = existingRow.querySelector('.quantity');
    quantityInput.value = parseInt(quantityInput.value) + 1;
    updateTotal(existingRow, product.price);
    row = existingRow;
  } else {
    row = document.createElement('tr');
    row.dataset.id = product.id;
    row.innerHTML = `
      <td>${product.name}</td>
      <td><input type="number" class="sale-price" value="${product.price}" onchange="updateTotal(this.parentElement.parentElement, ${product.price})"></td>
      <td><input type="number" class="quantity" value="1" min="1" onchange="updateTotal(this.parentElement.parentElement, ${product.price})"></td>
      <td class="total">${product.price.toFixed(2)}</td>
      <td><button class="btn btn-danger" onclick="removeFromSales(this)">Remove</button></td>
    `;
    salesTableBody.appendChild(row);
  }

  // Visual feedback for added product
  row.style.transition = 'background 0.3s ease';
  row.style.backgroundColor = '#fffbcc';
  setTimeout(() => row.style.backgroundColor = '', 2000);
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Update stock
  updateStockInDB(product.id, 1);

  // Calculate totals immediately
  calculateTotal();
  
  // Clear any pending discount timeout
  if (window.discountTimeout) {
    clearTimeout(window.discountTimeout);
  }
  
  // Schedule automatic discount after 3 seconds
  window.discountTimeout = setTimeout(applyAutoDiscount, 500);
}

// Ensure your calculateTotal function properly handles the discount
function calculateTotal() {
  let subtotal = 0;
  
  // Calculate subtotal from all products
  salesTableBody.querySelectorAll('tr').forEach(row => {
    subtotal += parseFloat(row.querySelector('.total').textContent) || 0;
  });
  
  // Get discount value
  const discountValue = parseFloat(document.getElementById('discount').value) || 0;
  const discountAmount = (subtotal * discountValue) / 100;
  const total = subtotal - discountAmount;
  
  // Update display
  document.getElementById('subtotal-display').textContent = `Subtotal: ${subtotal.toFixed(2)} SAR`;
  document.getElementById('discount-display').textContent = `Discount (${discountValue}%): -${discountAmount.toFixed(2)} SAR`;
  document.getElementById('total-display').textContent = `Total: ${total.toFixed(2)} SAR`;
  
  // Update payment status
  updatePaymentStatus(total);
}


// Remove product from sales
function removeFromSales(button) {
  button.closest('tr').remove();
  calculateTotal();
}

// Update total for a row in sales
function updateTotal(row, price) {
  const quantity = parseInt(row.querySelector('.quantity').value);
  const customPrice = parseFloat(row.querySelector('.sale-price').value);
  row.querySelector('.total').textContent = (quantity * customPrice).toFixed(2);
  calculateTotal();
}


function calculateTotal() {
  let subtotal = 0;

  // Sum up all the product totals from the sales table
  salesTableBody.querySelectorAll('.total').forEach((cell) => {
    subtotal += parseFloat(cell.textContent); // convert text content to float and sum
  });

  // Get discount value from the input field
  const discountValue = parseFloat(document.getElementById('discount').value) || 0; // default to 0 if empty
  const discountAmount = (subtotal * discountValue) / 100;
  const total = subtotal - discountAmount;

  // Update the display elements with subtotal, discount, and total
  document.getElementById('subtotal-display').textContent = `Subtotal: ${subtotal.toFixed(2)} SAR`;
  document.getElementById('discount-display').textContent = `Discount (${discountValue}%): -${discountAmount.toFixed(2)} SAR`;
  document.getElementById('total-display').textContent = `Total: ${total.toFixed(2)} SAR`;

  // Update paid and due amounts if payment is partial or unpaid
  updatePaymentStatus(total);
}





// Helper function to update payment status display
function updatePaymentStatus(total) {
  const paymentStatus = document.querySelector('input[name="payment-status"]:checked').value;
  const paidAmountInput = document.getElementById('paid-amount');
  const paidDisplay = document.getElementById('paid-display');
  const dueDisplay = document.getElementById('due-display');

  if (paymentStatus === 'paid') {
    paidDisplay.textContent = `Paid: ${total.toFixed(2)} SAR`;
    paidDisplay.style.display = 'none';
    dueDisplay.style.display = 'none';
  } 
  else if (paymentStatus === 'partial') {
    const paidAmount = parseFloat(paidAmountInput.value) || 0;
    paidDisplay.textContent = `Paid: ${paidAmount.toFixed(2)} SAR`;
    dueDisplay.textContent = `Due: ${(total - paidAmount).toFixed(2)} SAR`;
    paidDisplay.style.display = 'block';
    dueDisplay.style.display = 'block';
  } 
  else if (paymentStatus === 'unpaid') {
    paidDisplay.textContent = `Paid: 0.00 SAR`;
    dueDisplay.textContent = `Due: ${total.toFixed(2)} SAR`;
    paidDisplay.style.display = 'block';
    dueDisplay.style.display = 'block';
  }
}

// Event listeners for real-time updates
document.getElementById('discount').addEventListener('input', calculateTotal);
document.getElementById('paid-amount').addEventListener('input', function() {
  const total = parseFloat(document.getElementById('total-display').textContent.replace('Total: ', '').replace(' SAR', ''));
  updatePaymentStatus(total);
});

// Reset discount button functionality
document.getElementById('reset-discount-btn').addEventListener('click', function() {
  document.getElementById('discount').value = '';
  calculateTotal();
});

// Payment status radio buttons change listener
document.querySelectorAll('input[name="payment-status"]').forEach(radio => {
  radio.addEventListener('change', function() {
    const total = parseFloat(document.getElementById('total-display').textContent.replace('Total: ', '').replace(' SAR', ''));
    updatePaymentStatus(total);
    
    // Show/hide paid amount field based on selection
    const paidAmountSection = document.getElementById('paid-amount-section');
    if (this.value === 'partial') {
      paidAmountSection.style.display = 'block';
    } else {
      paidAmountSection.style.display = 'none';
    }
  });
});



// Reset discount function
function resetDiscount() {
  document.getElementById('discount').value = ''; // Clear the discount input field
  calculateTotal(); // Recalculate totals without discount
}

// Add an event listener to the reset button
document.getElementById('reset-discount-btn').addEventListener('click', resetDiscount);



// Print invoice
function printInvoice() {
  const printContents = document.querySelector('.sales-panel').innerHTML;
  const originalContents = document.body.innerHTML;
  document.body.innerHTML = printContents;
  window.print();
  document.body.innerHTML = originalContents;
}

// Render products on page load
request.onsuccess = function () {
  db = request.result;
  renderProducts();
};










// Print bill receipt with customer details and prescription
// Print bill receipt with customer details, prescription, and QR code
function printInvoice() {
  const printContents = document.querySelector('.sales-panel').innerHTML;
  const originalContents = document.body.innerHTML;

  // Get current date and time for printing
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleString();

  // Retrieve the last used receipt number from localStorage
  let receiptNumber = localStorage.getItem("receiptNumber");
  if (!receiptNumber) {
    receiptNumber = "0001";
  } else {
    const nextNumber = parseInt(receiptNumber) + 1;
    receiptNumber = nextNumber.toString().padStart(4, "0");
  }
  localStorage.setItem("receiptNumber", receiptNumber);

  // Calculate Subtotal and Total
  let subtotal = 0;
  const rows = salesTableBody.querySelectorAll('tr');
  rows.forEach((row) => {
    subtotal += parseFloat(row.querySelector('.total').textContent);
  });

  const discountValue = parseFloat(document.getElementById('discount').value) || 0;
  const discountAmount = (subtotal * discountValue) / 100;
  const totalPrice = subtotal - discountAmount;

  // Get customer details
  const customerName = document.getElementById('customer-name').value || 'Walk-in Customer';
  const customerMobile = document.getElementById('customer-mobile').value || 'N/A';
  const paymentMethod = document.getElementById('payment-method').value;
  const paymentStatus = document.querySelector('input[name="payment-status"]:checked').value;
  const paidAmount = paymentStatus === 'partial' ? parseFloat(document.getElementById('paid-amount').value) || 0 : 
                    paymentStatus === 'paid' ? totalPrice : 0;
  const dueAmount = totalPrice - paidAmount;

  // Get prescription details
  const prescriptionInputs = document.querySelectorAll('.prescription-input');
  const rightEyeSph = prescriptionInputs[0].value;
  const rightEyeCyl = prescriptionInputs[1].value;
  const rightEyeAxis = prescriptionInputs[2].value;
  const rightEyeAdd = prescriptionInputs[3].value;
  const leftEyeSph = prescriptionInputs[4].value;
  const leftEyeCyl = prescriptionInputs[5].value;
  const leftEyeAxis = prescriptionInputs[6].value;
  const leftEyeAdd = prescriptionInputs[7].value;
  const lpdRight = prescriptionInputs[8].value;
  const lpdLeft = prescriptionInputs[9].value;
  const clRight = prescriptionInputs[10].value;
  const clLeft = prescriptionInputs[11].value;
  const frameBrand = prescriptionInputs[12].value;
  const frameModel = prescriptionInputs[13].value;

  // Create a new print-friendly page
  const printWindow = window.open('', '', 'height=600,width=600');
  printWindow.document.write('<html><head><title>Receipt</title><style>');
  printWindow.document.write(`
    body { font-family: 'Arial'; font-size: 14px; }
    .sales-panel { padding: 10px; width: 100%; }
    .sales-panel table { width: 100%; border-collapse: collapse; }
    .sales-panel th, .sales-panel td { padding: 5px; text-align: left; font-size: 14px; }
    .sales-panel th { font-weight: bold; }
    .totals { font-weight: 800; text-align: right; font-size: 13px; margin-top: 10px; }
    .receipt-footer { text-align: center; margin-top: 10px; font-size: 14px; }
    .qrcode img { margin-top: 10px; width: 80px; height: 80px; }
    .customer-info { margin-bottom: 10px; }
    .payment-info { margin: 10px 0; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    .prescription-table { width: 100%; margin: 10px 0; }
    .prescription-table th, .prescription-table td { padding: 3px; text-align: center; }
    .prescription-header { text-align: center; font-weight: bold; margin: 10px 0; }
    .prescription-details { margin: 5px 0; }
    .frame-details { margin-top: 10px; }
    .receipt-header { text-align:center; display: flex; align-items: center; justify-content: center; }
  `);
  printWindow.document.write('</style></head><body>');

  // Header with business info
  printWindow.document.write(`
    <div class="receipt-header">
      <img src="logo.jpg" alt="
United Eyewear Logo" style="width: 50px; height: 50px; margin-right: 10px;filter: grayscale(100%);">
      <div>
        <h2>
          
United Eyewear<br>
          <span dir="rtl">متحدون للنظارات
</span>
        </h2>
      </div>
    </div>
    <p style="margin-top: 10px; text-align:center;">
      Abdur Rahman Ibn Ahmed As Sidayri, As Salamah, Jeddah<br>
      <span dir="rtl">عبد الرحمن بن أحمد السديري، السلامة، جدة</span><br><br>
      <b>Phone:</b> +966 
05 6308 2336<br>
     
      ____________________________________________________________
    </p>
    <div class="sales-panel">
      <h3 style="text-align:center;">VAT No: 310492567700003 </h3>
       <h3 style="text-align:center;">CR: 4030310929 </h3>
      <p style="text-align:center; font-size: 14px; font-weight:bold;">Invoice No: ${receiptNumber}</p>
      <p style="text-align:center; font-size: 12px;">Date: ${formattedDate}</p>
       
      <div class="divider"></div>
      
       <!-- Customer Information -->
      <div class="customer-info" style="text-align:center;">
        <div class="prescription-header">CUSTOMER INFO</div>
        <p style="font-size:14px"><b>Customer:</b> ${customerName}</p>
        <p style="font-size:14px"><b>Mobile:</b> ${customerMobile}</p>
      </div><br>


            <div class="divider"></div>


      <!-- Products Table -->
      <table>
        <thead>
          <tr>
            <th>المنتج<br><u>Product</u></th>
            <th>الكمية<br><u>Qty</u></th>
            <th>السعر<br><u>Price</u></th>
          </tr>
        </thead>
        <tbody>
  `);

  // Loop through the sales table and add each item
  rows.forEach((row) => {
    const productName = row.querySelector('td').textContent.trim();
    const quantity = row.querySelector('.quantity').value;
    const total = row.querySelector('.total').textContent;

    printWindow.document.write(`
      <tr>
        <td>${productName}</td>
        <td>${quantity}</td>
        <td>${total}</td>
      </tr>
    `);
  });

  // Payment information and totals
  printWindow.document.write(`
        </tbody>
      </table>
        
      <div class="divider"></div>

      <!-- Totals -->
      <div class="totals">
        <p>Subtotal: ${subtotal.toFixed(2)} SAR</p>
        <p>Discount (${discountValue}%): -${discountAmount.toFixed(2)} SAR</p>
        <p>_____________________________</p>
        <p><b>Total: ${totalPrice.toFixed(2)} SAR </b> <br>(including all vat and taxes)</p>
      </div>
      <div class="divider"></div>

      <!-- Payment Information -->
      <div class="payment-info">
        <p><b>Payment Method:</b> ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</p>
        <p><b>Payment Status:</b> ${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</p>
        ${paymentStatus === 'partial' || paymentStatus === 'unpaid' ? 
          `<p><b>Paid Amount:</b> ${paidAmount.toFixed(2)} SAR</p>
           <p><b>Due Amount:</b> ${dueAmount.toFixed(2)} SAR</p>` : ''}
      </div>
      <div class="divider"></div><br>
      
     
      
      <!-- Prescription Information -->
      <div class="divider"></div>
      <div class="prescription-header">EYE PRESCRIPTION</div>
      
      <table class="prescription-table" style="border:1px solid black">
        <thead style="border:1px solid black ;background:silver;">
          <tr>
            <th>EYE</th>
            <th>S.P.H</th>
            <th>C.Y.L</th>
            <th>AXIS</th>
            <th>ADD</th>
          </tr>
        </thead>
        <tbody style="border:1px solid black">
          <tr style="border:1px solid black;">
            <td style="border-right: 1px solid black;">Right</td>
            <td style="border-right: 1px solid black;">${rightEyeSph}</td>
            <td style="border-right: 1px solid black;">${rightEyeCyl}</td>
            <td style="border-right: 1px solid black;">${rightEyeAxis || 'N/A'}</td>
            <td style="border-right: 1px solid black;">${rightEyeAdd}</td>
          </tr>
          <tr style="border:1px solid black;">
            <td style="border-right: 1px solid black;">Left</td>
            <td style="border-right: 1px solid black;">${leftEyeSph}</td>
            <td style="border-right: 1px solid black;">${leftEyeCyl}</td>
            <td style="border-right: 1px solid black;">${leftEyeAxis || 'N/A'}</td>
            <td style="border-right: 1px solid black;">${leftEyeAdd}</td>
          </tr>
          <th colspan="3" style="text-align: center; border-right: 1px solid black; background:silver;">L.P.D</th>
          <tr style="border:1px solid black;">
            <td style="border-right: 1px solid black;">Right</td>
            <td colspan="2" style="border-right: 1px solid black;">${lpdRight}</td>
          </tr>
          <tr style="border:1px solid black;">
            <td style="border-right: 1px solid black;">Left</td>
            <td colspan="2" style="border-right: 1px solid black;">${lpdLeft}</td>
          </tr>
          <th colspan="3" style="text-align: center; border-right: 1px solid black; background:silver;">C.L</th>
          <tr style="border:1px solid black;">
            <td style="border-right: 1px solid black;">Right</td>
            <td colspan="2" style="border-right: 1px solid black;">${clRight}</td>
          </tr>
          <tr style="border:1px solid black;">
            <td style="border-right: 1px solid black;">Left</td>
            <td colspan="2" style="border-right: 1px solid black;">${clLeft}</td>
          </tr>
        </tbody>
      </table>

      <!-- Generate QR code with receipt data -->
      <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
      <script>
        const qr = qrcode(0, 'L');
        qr.addData(\`
          
United Eyewear\\n
          Invoice No: ${receiptNumber}\\n
          Date: ${formattedDate}\\n
          Customer: ${customerName}\\n
          Mobile: ${customerMobile}\\n
          Total: ${totalPrice.toFixed(2)} SAR\\n
          Payment: ${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}\\n
          Items: ${rows.length}\\n
          Paid: ${paidAmount.toFixed(2)} SAR\\n
          Due: ${dueAmount.toFixed(2)} SAR
        \`);
        qr.make();
        document.write(\`
          <div class="qrcode">
            <center>
             
              \${qr.createImgTag(4)}
            </center>
          </div>
        \`);
      </script>

      <div class="receipt-footer">
        <p>----------------------------------------------</p>
        <p>Thank you for shopping with us!<br>
          <span dir="rtl">شكراً لتسوقك معنا!</span>
        </p>
      </div>
  `);

  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
}






// Function to print stylish barcodes
function printBarcodes() {
  // Create a new window for the print-friendly page
  const printWindow = window.open('', '', 'height=800,width=800');
  printWindow.document.write('<html><head><title>Stylish Barcode Stickers</title><style>');
  
  // Add CSS for a professional, compact layout
  printWindow.document.write(`
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      font-size: 14px; 
      margin: 0; 
      padding: 0; 
      background-color: #f8f8f8; 
    }
    .barcode-container { 
      display: flex; 
      flex-wrap: wrap; 
      justify-content: center; 
      padding: 10px; 
    }
    .barcode-sticker { 
      width: 280px; 
      height: 150px; 
      border: 1px solid #000; 
      border-radius: 5px; 
      margin: 5px; 
      padding: 8px; 
      text-align: center; 
      background-color: #fff; 
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); 
    }
    .barcode-sticker img { 
      width: 180px; 
      height: 60px; 
      margin: 4px 0; 
    }
    .product-name { 
      font-size: 13px; 
      font-weight: bold; 
      color: #000; 
      text-transform: uppercase; 
      margin-bottom: 4px; 
    }
    .product-category { 
      font-size: 10px; 
      color: #555; 
      margin: 2px 0; 
    }
      .product-mrp { 
      font-size: 12px; 
      font-weight:bold;
      color: #555; 
      margin: 2px 0; 
    }
    .shop-name { 
      font-size: 10px; 
      font-weight: bold; 
      text-align: left; 
      border: 1px solid #3b3b3b; 
      padding: 2px; 
      display: inline-block; 
      margin-bottom: 0px; 
    }
    .barcode-number { 
      font-size: 10px; 
      color: #333; 
      margin-top: 0px; 
    }
  `);
  Window.document.write('</style></head><body>');
  
  // Create a container for all the barcode stickers
  printWindow.document.write('<div class="barcode-container">');

  // Loop through all products and display their barcode with info
  products.forEach((product) => {
    // Create a canvas element for each barcode
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, product.id.toString(), {
      format: 'CODE128',
      lineColor: '#000',
      width: 3,
      height: 60,
      displayValue: true, // Hide text under the barcode
    });

    // Convert the canvas to a data URL (image) and embed it in the print layout
    const barcodeDataUrl = canvas.toDataURL('image/png');

    // Append the barcode image with additional details to the print layout
    printWindow.document.write(`
      <div class="barcode-sticker">
        <div class="shop-name">
United Eyewear</div>
        <p class="product-name">${product.name}</p>
        <img src="${barcodeDataUrl}" alt="barcode">
        <p class="product-mrp">Price: ${product.price} SAR</p>
        <p class="product-category">Category: ${product.category}</p>
      </div>
    `);
  });

  printWindow.document.write('</div>');
  printWindow.document.write('</body></html>');
  printWindow.document.close(); // Close the document to finish writing

  // Print the page with barcodes
  printWindow.print();
}







document.getElementById('product-search').addEventListener('input', function () {
  const query = this.value.toLowerCase();
  const rows = document.querySelectorAll('#product-table tbody tr');

  rows.forEach(row => {
    const name = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
    const category = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
    const barcode = row.querySelector('td:nth-child(5)').textContent.toLowerCase();

    if (name.includes(query) || category.includes(query) || barcode.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
});










const rowsPerPage = 10; // Number of products per page
let currentPage = 1;

function updateTable() {
  const tableBody = document.querySelector('#product-table tbody');
  const rows = Array.from(tableBody.querySelectorAll('tr'));
  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  // Hide all rows
  rows.forEach(row => (row.style.display = 'none'));

  // Show rows for the current page
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);

  for (let i = startIndex; i < endIndex; i++) {
    rows[i].style.display = '';
  }

  // Update pagination controls
  document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;
}

// Ensure the table updates on initial load
document.addEventListener('DOMContentLoaded', () => {
  updateTable();
});

// Pagination button event listeners
document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    updateTable();
  }
});

document.getElementById('next-page').addEventListener('click', () => {
  const totalRows = document.querySelectorAll('#product-table tbody tr').length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    updateTable();
  }
});












// Save bill with all details and reset form
function saveBill() {
  const currentDate = new Date().toLocaleString();

  // Get customer details
  const customerName = document.getElementById('customer-name').value || 'Walk-in Customer';
  const customerMobile = document.getElementById('customer-mobile').value || 'N/A';
  const paymentMethod = document.getElementById('payment-method').value;
  const paymentStatus = document.querySelector('input[name="payment-status"]:checked').value;
  
  // Calculate paid amount based on status
  const totalAmount = parseFloat(document.getElementById('total-display').textContent.replace('Total: ', '').replace(' SAR', '')) || 0;
  const paidAmount = paymentStatus === 'partial' ? parseFloat(document.getElementById('paid-amount').value) || 0 : 
                    paymentStatus === 'paid' ? totalAmount : 0;
  const dueAmount = totalAmount - paidAmount;

  // Get discount details
  const discountValue = parseFloat(document.getElementById('discount').value) || 0;
  const discountAmount = parseFloat(document.getElementById('discount-display').textContent.match(/-(\d+\.\d{2})/)[1]) || 0;

  // Create bill object with all details
  const bill = {
    date: currentDate,
    invoiceNumber: localStorage.getItem("receiptNumber") || "0001",
    customer: {
      name: customerName,
      mobile: customerMobile
    },
    payment: {
      method: paymentMethod,
      status: paymentStatus,
      paid: paidAmount,
      due: dueAmount
    },
    discount: {
      percentage: discountValue,
      amount: discountAmount
    },
    items: [],
    subtotal: parseFloat(document.getElementById('subtotal-display').textContent.replace('Subtotal: ', '').replace(' SAR', '')) || 0,
    total: totalAmount
  };

  // Add items to bill
  const rows = document.querySelectorAll('#sales-table tbody tr');
  rows.forEach(row => {
    const productName = row.querySelector('td').textContent.trim();
    const price = parseFloat(row.querySelector('.sale-price').value) || 0;
    const quantity = parseInt(row.querySelector('.quantity').value) || 0;
    const total = parseFloat(row.querySelector('.total').textContent) || 0;

    bill.items.push({ 
      productName, 
      price, 
      quantity, 
      total 
    });
  });

  // Save to localStorage
  let savedBills = JSON.parse(localStorage.getItem('savedBills')) || [];
  savedBills.push(bill);
  localStorage.setItem('savedBills', JSON.stringify(savedBills));

  // Increment receipt number for next bill
  let receiptNumber = localStorage.getItem("receiptNumber");
  if (!receiptNumber) {
    receiptNumber = "0001";
  } else {
    const nextNumber = parseInt(receiptNumber) + 1;
    receiptNumber = nextNumber.toString().padStart(4, "0");
  }
  localStorage.setItem("receiptNumber", receiptNumber);

  // Reset form
  resetSalesForm();
  
  alert('Bill saved successfully!');
}

// Function to reset the sales form
function resetSalesForm() {
  // Clear sales table
  document.querySelector('#sales-table tbody').innerHTML = '';
  
  // Reset totals and discount
  document.getElementById('subtotal-display').textContent = 'Subtotal: 0.00 SAR';
  document.getElementById('discount-display').textContent = 'Discount (0%): -0.00 SAR';
  document.getElementById('total-display').textContent = 'Total: 0.00 SAR';
  document.getElementById('paid-display').style.display = 'none';
  document.getElementById('due-display').style.display = 'none';
  
  // Reset input fields
  document.getElementById('discount').value = '';
  document.getElementById('customer-name').value = '';
  document.getElementById('customer-mobile').value = '';
  document.getElementById('payment-method').value = 'cash';
  document.getElementById('paid-amount').value = '';
  
  // Reset payment status to default (paid)
  document.querySelector('input[name="payment-status"][value="paid"]').checked = true;
  document.getElementById('paid-amount-section').style.display = 'none';
  
  // Focus on barcode scanner for next sale
  document.getElementById('barcode-scanner').focus();
}






//filter product
function applyFilter() {
  const filterValue = document.getElementById("product-filter").value;
  const rows = Array.from(document.querySelectorAll("#product-table tbody tr"));
  
  if (filterValue === "all") {
    rows.forEach(row => row.style.display = "");
  } else if (filterValue === "newest") {
    rows.sort((a, b) => new Date(b.dataset.addedDate) - new Date(a.dataset.addedDate));
  } else if (filterValue === "low-to-high") {
    rows.sort((a, b) => parseFloat(a.querySelector("td:nth-child(3)").innerText) -
                        parseFloat(b.querySelector("td:nth-child(3)").innerText));
  } else if (filterValue === "high-to-low") {
    rows.sort((a, b) => parseFloat(b.querySelector("td:nth-child(3)").innerText) -
                        parseFloat(a.querySelector("td:nth-child(3)").innerText));
  }
  
  const tbody = document.querySelector("#product-table tbody");
  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
}












// Export products to JSON file
function exportProductsToJSON() {
  const transaction = db.transaction([storeName], "readonly");
  const store = transaction.objectStore(storeName);
  const request = store.getAll(); // Get all products

  request.onsuccess = function () {
    const products = request.result;

    if (products.length === 0) {
      alert("No products to export.");
      return;
    }

    // Convert products to JSON string
    const dataStr = JSON.stringify(products, null, 2);

    // Create a Blob from the JSON string
    const blob = new Blob([dataStr], { type: "application/json" });

    // Create a download link for the JSON file
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.json"; // Set the file name for download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a); // Remove the link after clicking

    // Optional: Revoke the object URL to free up resources
    URL.revokeObjectURL(url);
  };

  request.onerror = function () {
    alert("Error exporting products.");
    console.error("Error exporting products.");
  };
}

// Export Button Event Listener
document.getElementById("exportBtn").addEventListener("click", exportProductsToJSON);


//import profuct json
function importProductsFromJSON(fileInput) {
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select a file to import.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const importedProducts = JSON.parse(e.target.result); // Parse the JSON data

    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    // Add each product to the IndexedDB store
    importedProducts.forEach((product) => {
      store.put(product); // Use 'put' to add or update the product
    });

    transaction.oncomplete = function () {
      console.log('Products imported successfully.');
      renderProducts(); // Refresh the product list after import
    };

    transaction.onerror = function (event) {
      console.error('Error importing products:', event);
    };
  };

  reader.onerror = function () {
    console.error('Error reading file.');
  };

  reader.readAsText(file); // Read the file as text
}


















// Show notification when the page loads
function showNotification() {
  const notification = document.getElementById('notification');
  notification.classList.remove('hidden');

  // Auto-hide after 7 seconds
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 7000);
}

// Close notification on button click
document.getElementById('close-notification').addEventListener('click', () => {
  const notification = document.getElementById('notification');
  notification.classList.add('hidden');
});

// Trigger the notification when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', showNotification);
