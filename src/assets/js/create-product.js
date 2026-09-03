// Handles the "Add Product" form on create-product.html.
// Waits a tick for api.js (loaded just before this file) to attach window.FabricNowAPI.

function showAlert(message, type = "danger") {
  const alertBox = document.getElementById("formAlert");
  if (!alertBox) return;
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = message;
  alertBox.classList.remove("d-none");
}

function hideAlert() {
  const alertBox = document.getElementById("formAlert");
  if (alertBox) alertBox.classList.add("d-none");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addProductForm");
  if (!form) return;

  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();

    const imageInput = document.getElementById("productImage");
    const hasFile = imageInput.files && imageInput.files.length > 0;

    const fields = {
      name: document.getElementById("productName").value.trim(),
      sku: document.getElementById("productSKU").value.trim(),
      price: document.getElementById("productPrice").value,
      stock: document.getElementById("productStock").value,
      category: document.getElementById("productCategory").value,
      brand: document.getElementById("productBrand").value.trim() || "FabricNow",
      style: document.getElementById("productStyle").value,
      fabric: document.getElementById("productFabric").value,
      color: document.getElementById("productColor").value.trim(),
      description: document.getElementById("productDescription").value.trim(),
    };

    if (!fields.name || !fields.price || !fields.stock || !fields.category || !fields.style || !fields.fabric) {
      showAlert("Please fill in all required fields (name, price, stock, category, style, fabric).");
      return;
    }

    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
    if (hasFile) formData.append("image", imageInput.files[0]);

    submitBtn.disabled = true;
    submitBtn.textContent = "Adding...";

    try {
      if (!window.FabricNowAPI.authToken()) {
        showAlert(
          "You're not signed in. Sign in first, or the request will be rejected by the API.",
          "warning"
        );
      }
      await window.FabricNowAPI.createProduct(formData);
      showAlert("Product added successfully! It's now live on the storefront.", "success");
      form.reset();
    } catch (err) {
      showAlert(err.message || "Something went wrong while adding the product.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Add Product";
    }
  });
});
