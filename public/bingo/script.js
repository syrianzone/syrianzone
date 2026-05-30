document.addEventListener("DOMContentLoaded", function () {
  generateBingoCard(); // Always generate the Bingo grid on page load
  loadListFromUrl(); // Load the list from URL if available
});

let originalItems = [];

function generateBingoCard() {
  const bingoCardContainer = document.querySelector('.grid');
  let itemsInput = document.getElementById("itemsInput").value.split('\n');

  // Trim empty lines from the beginning and end of the input
  itemsInput = itemsInput.map(item => item.trim()).filter(item => item !== '');

// Assuming you have another array called 'otherArray' from which you want to pick items randomly
const otherArray = [
  'على تويتر',
  'على فيسبوك',
  'على انستاغرام',
  'بنضارة شمسية',
  'بجاكيت ابيض',
  'بجاكيت اسود',
  'مع مسؤول',
  'مع الرئيس',
  'مع مواطن',
  'في دمشق',
  'في القصر',
  'في الشارع',
  'مع ممثل/ة',
  'مع اعلامي',
  'في سيارة',
  'في طائرة',
  'يبتسم',
  'غاضب',
  'في حدث رسمي',
  'مع عامل',
  'مع عنصر امن',
  'مع عنصر دفاع مدني',
  'مع شخص غير سوري',
  'نظارة على راسه'
];

while (itemsInput.length < 24 && itemsInput.length < otherArray.length) {
  const randomItem = otherArray[Math.floor(Math.random() * otherArray.length)];
  if (!itemsInput.includes(randomItem)) {
    itemsInput.push(randomItem);
  }
}

  // If there are more than 24 items, pick the first 24
  itemsInput = itemsInput.slice(0, 24);

  // Save the original items for reshuffling
  originalItems = [...itemsInput];

  // Shuffle items excluding "FREE"
  const shuffledItems = shuffleArray(itemsInput);

  // Ensure "FREE" is always in the center
  const centerIndex = Math.floor(shuffledItems.length / 2);
  shuffledItems.splice(centerIndex, 0, "FREE");

  // Clear existing content
  bingoCardContainer.innerHTML = "";

  for (let i = 0; i < 25; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell", "w-16", "h-16", "flex", "items-center", "justify-center", "border", "rounded-md", "text-center");
    cell.textContent = shuffledItems[i];
    cell.addEventListener("click", markCell);
    bingoCardContainer.appendChild(cell);
  }

  updateSavedListLink(); // Update the saved list link after generating the Bingo card
}

function reshuffleItems() {
  if (originalItems) {
    const itemsInput = document.getElementById("itemsInput");
    itemsInput.value = originalItems.join('\n');
    generateBingoCard();
  } else {
    alert("Please generate the Bingo card first.");
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function markCell() {
  // Toggle the "marked" class for the cell
  this.classList.toggle("marked");
  // Check if the cell is marked
  const isMarked = this.classList.contains("marked");
  // Set background color based on the marked status
  this.style.backgroundColor = isMarked ? "rgba(60, 179, 113, 0.3)" : "";
  checkWin();
}

function checkWin() {
  const cells = document.querySelectorAll('.cell');
  const rows = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24]];
  const columns = [[0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24]];
  const diagonals = [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];

  // Check rows
  for (const row of rows) {
    if (row.every(index => cells[index].classList.contains("marked"))) {
      announceWinner();
      return;
    }
  }

  // Check columns
  for (const column of columns) {
    if (column.every(index => cells[index].classList.contains("marked"))) {
      announceWinner();
      return;
    }
  }

  // Check diagonals
  for (const diagonal of diagonals) {
    if (diagonal.every(index => cells[index].classList.contains("marked"))) {
      announceWinner();
      return;
    }
  }
}

function announceWinner() {
  // Play the win sound
  const winSound = document.getElementById("winSound");
  winSound.play();
}

function saveList() {
  const itemsInput = document.getElementById("itemsInput");
  const items = itemsInput.value.trim().split('\n').map(item => item.trim());

  // Encode the list as a URL parameter
  const encodedList = encodeURIComponent(items.join('\n'));

  // Create a URL with the encoded list as a parameter
  const currentUrl = window.location.href.split('?')[0];
  const listUrl = `${currentUrl}?list=${encodedList}`;

  // Display the URL in the saved list link box
  document.getElementById("savedListLink").innerHTML = `
    <p class="text-sm">Saved List URL:</p>
    <textarea readonly class="mt-1 p-2 block w-full border rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300">${listUrl}</textarea>
  `;
}

function loadListFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const encodedList = urlParams.get('list');

  if (encodedList) {
    // Decode the URL parameter and set the items input
    const decodedList = decodeURIComponent(encodedList);
    document.getElementById("itemsInput").value = decodedList;
    generateBingoCard(); // Generate Bingo card with the loaded list
  }
}

function updateSavedListLink() {
  const itemsInput = document.getElementById("itemsInput");
  const items = itemsInput.value.trim().split('\n').map(item => item.trim());

  // Encode the list as a URL parameter
  const encodedList = encodeURIComponent(items.join('\n'));

  // Create a URL with the encoded list as a parameter
  const currentUrl = window.location.href.split('?')[0];
  const listUrl = `${currentUrl}?list=${encodedList}`;

  // Display the URL in the saved list link box
  document.getElementById("savedListLink").innerHTML = `
    <p class="text-sm">Saved List URL:</p>
    <textarea readonly class="mt-1 p-2 block w-full border rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300">${listUrl}</textarea>
  `;
}
