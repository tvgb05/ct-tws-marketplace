export type MarketplaceSubcategory = {
  slug: string;
  label: string;
};

export type MarketplaceCategory = {
  slug: string;
  label: string;
  icon: string;
  subcategories: MarketplaceSubcategory[];
};

export const categories: MarketplaceCategory[] = [
  { slug: "all", label: "Tất cả", icon: "✦", subcategories: [] },
  {
    slug: "tech",
    label: "Điện tử & công nghệ",
    icon: "⌘",
    subcategories: [
      { slug: "phones", label: "Điện thoại" },
      { slug: "tablets", label: "Máy tính bảng" },
      { slug: "computers", label: "Laptop & máy tính" },
      { slug: "pc-components", label: "Linh kiện máy tính" },
      { slug: "keyboards-mice", label: "Bàn phím & chuột" },
      { slug: "headphones", label: "Tai nghe" },
      { slug: "speakers", label: "Loa" },
      { slug: "microphones", label: "Micro" },
      { slug: "cameras", label: "Máy ảnh & quay phim" },
      { slug: "smartwatches", label: "Đồng hồ thông minh" },
      { slug: "chargers", label: "Củ sạc" },
      { slug: "power-banks", label: "Sạc dự phòng" },
      { slug: "charging-cables", label: "Cáp sạc & cáp dữ liệu" },
      { slug: "adapters", label: "Adapter & bộ chuyển đổi" },
      { slug: "hubs-docks", label: "Hub & dock chuyển đổi" },
      { slug: "cases-stands", label: "Ốp, bao da & giá đỡ" },
      { slug: "networking", label: "Thiết bị mạng" },
      { slug: "gaming", label: "Thiết bị gaming" },
      { slug: "electronic-parts", label: "Linh kiện điện tử" },
      { slug: "flashlights", label: "Đèn pin" },
    ],
  },
  {
    slug: "appliances",
    label: "Gia dụng",
    icon: "⌂",
    subcategories: [
      { slug: "cookware", label: "Nồi, chảo & dụng cụ bếp" },
      { slug: "kitchen-appliances", label: "Thiết bị nhà bếp" },
      { slug: "cleaning", label: "Máy hút bụi & vệ sinh" },
      { slug: "fans", label: "Quạt & làm mát" },
      { slug: "air-conditioners", label: "Điều hòa & điện lạnh" },
      { slug: "laundry", label: "Giặt ủi" },
      { slug: "water-appliances", label: "Máy lọc & bình nước" },
      { slug: "small-appliances", label: "Gia dụng nhỏ" },
    ],
  },
  {
    slug: "home",
    label: "Nội thất & nhà cửa",
    icon: "▱",
    subcategories: [
      { slug: "tables-chairs", label: "Bàn & ghế" },
      { slug: "sofas", label: "Sofa" },
      { slug: "beds", label: "Giường & nệm" },
      { slug: "cabinets", label: "Tủ & kệ" },
      { slug: "lighting", label: "Đèn trang trí" },
      { slug: "decor", label: "Đồ trang trí" },
      { slug: "bedding", label: "Chăn ga & phòng ngủ" },
      { slug: "bathroom", label: "Đồ dùng phòng tắm" },
    ],
  },
  {
    slug: "handmade",
    label: "Đồ thủ công",
    icon: "✣",
    subcategories: [
      { slug: "handmade-bags", label: "Túi & phụ kiện" },
      { slug: "ceramics", label: "Gốm sứ" },
      { slug: "knitting", label: "Đan móc" },
      { slug: "handmade-decor", label: "Đồ trang trí" },
    ],
  },
  {
    slug: "fashion",
    label: "Thời trang",
    icon: "◒",
    subcategories: [
      { slug: "menswear", label: "Thời trang nam" },
      { slug: "womenswear", label: "Thời trang nữ" },
      { slug: "shoes", label: "Giày dép" },
      { slug: "bags-wallets", label: "Túi & ví" },
      { slug: "watches", label: "Đồng hồ" },
      { slug: "jewelry", label: "Trang sức" },
      { slug: "fashion-accessories", label: "Phụ kiện thời trang" },
    ],
  },
  {
    slug: "books",
    label: "Sách & học tập",
    icon: "▤",
    subcategories: [
      { slug: "literature", label: "Văn học" },
      { slug: "textbooks", label: "Giáo trình" },
      { slug: "stationery", label: "Văn phòng phẩm" },
      { slug: "learning-tools", label: "Dụng cụ học tập" },
    ],
  },
  {
    slug: "beauty",
    label: "Làm đẹp",
    icon: "✿",
    subcategories: [
      { slug: "skincare", label: "Chăm sóc da" },
      { slug: "makeup", label: "Trang điểm" },
      { slug: "perfume", label: "Nước hoa" },
      { slug: "haircare", label: "Chăm sóc tóc" },
    ],
  },
  {
    slug: "sports",
    label: "Thể thao",
    icon: "◆",
    subcategories: [
      { slug: "fitness", label: "Gym & fitness" },
      { slug: "running", label: "Chạy bộ" },
      { slug: "cycling", label: "Đạp xe" },
      { slug: "badminton", label: "Cầu lông" },
      { slug: "football", label: "Bóng đá" },
      { slug: "swimming", label: "Bơi lội" },
      { slug: "outdoor", label: "Dã ngoại" },
      { slug: "sportswear", label: "Trang phục thể thao" },
    ],
  },
  {
    slug: "vehicles",
    label: "Xe cộ",
    icon: "◈",
    subcategories: [
      { slug: "motorbikes", label: "Xe máy" },
      { slug: "bicycles", label: "Xe đạp" },
      { slug: "car-parts", label: "Phụ tùng ô tô" },
      { slug: "vehicle-accessories", label: "Phụ kiện xe" },
    ],
  },
  {
    slug: "food",
    label: "Thực phẩm",
    icon: "◐",
    subcategories: [
      { slug: "dry-food", label: "Đồ khô" },
      { slug: "beverages", label: "Đồ uống" },
      { slug: "homemade-food", label: "Đồ nhà làm" },
      { slug: "specialties", label: "Đặc sản" },
    ],
  },
  {
    slug: "other",
    label: "Khác",
    icon: "…",
    subcategories: [
      { slug: "collectibles", label: "Đồ sưu tầm" },
      { slug: "tickets", label: "Vé & voucher" },
      { slug: "miscellaneous", label: "Khác" },
    ],
  },
];
