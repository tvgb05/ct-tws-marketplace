"use client";
import {
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { categories } from "@/lib/marketplace-taxonomy";
import { ListingCard } from "@/components/listing-card";
import { ADMIN_FACEBOOK_URL } from "@/lib/constants";
import { formatPriceInput, parsePriceInput } from "@/lib/format";
import { vietnamProvinces } from "@/lib/vietnam-provinces";
import type { MarketplaceListing } from "@/lib/marketplace-types";

type Sort = "newest" | "oldest" | "price_asc" | "price_desc";
type Shipping = "all" | "yes" | "no";
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function MarketplaceExplorer() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    [],
  );
  const [condition, setCondition] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [province, setProvince] = useState("all");
  const [shipping, setShipping] = useState<Shipping>("all");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "50", sort });
      if (search.trim()) params.set("search", search.trim());
      if (selectedCategories.length)
        params.set("categories", selectedCategories.join(","));
      if (selectedSubcategories.length)
        params.set("subcategories", selectedSubcategories.join(","));
      if (condition !== "all") params.set("condition", condition);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      const selectedProvince = vietnamProvinces.find(
        (item) => item.code === province,
      );
      if (selectedProvince) params.set("location", selectedProvince.label);
      if (shipping !== "all") params.set("shipping", shipping);
      setLoading(true);
      setLoadError(false);
      void fetch(`${apiUrl}/listings?${params}`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const result = (await response.json()) as {
            data: MarketplaceListing[];
          };
          setListings(result.data);
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError"))
            setLoadError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    search,
    selectedCategories,
    selectedSubcategories,
    condition,
    minPrice,
    maxPrice,
    province,
    shipping,
    sort,
  ]);

  const toggleCategory = (slug: string) => {
    if (slug === "all") {
      setSelectedCategories([]);
      setSelectedSubcategories([]);
      return;
    }
    setSelectedCategories((current) => {
      if (!current.includes(slug)) return [...current, slug];
      const childSlugs =
        categories
          .find((item) => item.slug === slug)
          ?.subcategories.map((item) => item.slug) ?? [];
      setSelectedSubcategories((selected) =>
        selected.filter((item) => !childSlugs.includes(item)),
      );
      return current.filter((item) => item !== slug);
    });
  };

  const toggleSubcategory = (slug: string) =>
    setSelectedSubcategories((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setCondition("all");
    setMinPrice("");
    setMaxPrice("");
    setProvince("all");
    setShipping("all");
  };

  const activeFilterCount =
    selectedCategories.length +
    selectedSubcategories.length +
    (condition === "all" ? 0 : 1) +
    (minPrice || maxPrice ? 1 : 0) +
    (province === "all" ? 0 : 1) +
    (shipping === "all" ? 0 : 1);

  const visibleSubcategories = useMemo(
    () =>
      categories
        .filter((item) => selectedCategories.includes(item.slug))
        .flatMap((item) => item.subcategories),
    [selectedCategories],
  );

  const listingGroups = useMemo(() => {
    const groups = new Map<string, MarketplaceListing[]>();
    for (const listing of listings) {
      const key = listing.orderCode ?? listing.id;
      const group = groups.get(key);
      if (group) group.push(listing);
      else groups.set(key, [listing]);
    }
    return Array.from(groups.values());
  }, [listings]);

  const productCount = listings.length;
  const orderCount = listingGroups.length;

  return (
    <>
      <section className="market-hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <Sparkles size={15} /> Marketplace của cộng đồng
            </span>
            <h1>
              Món đồ phù hợp.
              <br />
              <em>Đúng người cần.</em>
            </h1>
            <p>
              Mua bán tử tế, thông tin minh bạch và luôn có admin cộng đồng sẵn
              sàng hỗ trợ khi bạn cần.
            </p>
            <div className="hero-search">
              <Search size={21} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tên món, mã SP-… hoặc mã đơn D-123456"
              />
              <button>Tìm kiếm</button>
            </div>
          </div>
        </div>
      </section>

      <main className="market-main">
        <section className="filter-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker filter-kicker">
                <SlidersHorizontal size={14} /> BỘ LỌC SẢN PHẨM
              </span>
              <h2>Tìm đúng món đồ bạn cần</h2>
              <p>Chọn nhiều tiêu chí để thu hẹp kết quả nhanh hơn.</p>
            </div>
            {activeFilterCount > 0 && (
              <button className="reset-filter" onClick={clearFilters}>
                <RotateCcw size={14} /> Xóa bộ lọc <b>{activeFilterCount}</b>
              </button>
            )}
          </div>
          <div className="filter-panel">
            <div className="filter-grid">
              <div className="filter-group filter-group-wide">
                <span>Danh mục</span>
                <div className="filter-options">
                  <button
                    className={selectedCategories.length === 0 ? "active" : ""}
                    onClick={() => toggleCategory("all")}
                  >
                    Tất cả
                  </button>
                  {categories
                    .filter((item) => item.slug !== "all")
                    .map((item) => (
                      <button
                        key={item.slug}
                        className={
                          selectedCategories.includes(item.slug) ? "active" : ""
                        }
                        onClick={() => toggleCategory(item.slug)}
                      >
                        {item.label}
                      </button>
                    ))}
                </div>
                {visibleSubcategories.length > 0 && (
                  <div className="subcategory-filter">
                    <b>Danh mục con</b>
                    <div className="filter-options subcategory-options">
                      <button
                        className={
                          selectedSubcategories.length === 0 ? "active" : ""
                        }
                        onClick={() => setSelectedSubcategories([])}
                      >
                        Tất cả
                      </button>
                      {visibleSubcategories.map((item) => (
                        <button
                          key={item.slug}
                          className={
                            selectedSubcategories.includes(item.slug)
                              ? "active"
                              : ""
                          }
                          onClick={() => toggleSubcategory(item.slug)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="filter-group">
                <span>Tình trạng</span>
                <div className="filter-options compact">
                  <button
                    className={condition === "all" ? "active" : ""}
                    onClick={() => setCondition("all")}
                  >
                    Tất cả
                  </button>
                  <button
                    className={condition === "NEW" ? "active" : ""}
                    onClick={() => setCondition("NEW")}
                  >
                    Mới
                  </button>
                  <button
                    className={condition === "USED" ? "active" : ""}
                    onClick={() => setCondition("USED")}
                  >
                    Đã dùng
                  </button>
                </div>
              </div>
              <div className="filter-group">
                <span>Khoảng giá tùy chỉnh</span>
                <div className="price-range-inputs">
                  <label>
                    <span>Từ</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatPriceInput(minPrice)}
                      onChange={(event) =>
                        setMinPrice(parsePriceInput(event.target.value))
                      }
                      placeholder="0"
                    />
                  </label>
                  <i>–</i>
                  <label>
                    <span>Đến</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatPriceInput(maxPrice)}
                      onChange={(event) =>
                        setMaxPrice(parsePriceInput(event.target.value))
                      }
                      placeholder="Không giới hạn"
                    />
                  </label>
                </div>
              </div>
              <label className="filter-group">
                <span>Tỉnh / thành phố</span>
                <span className="select-wrap">
                  <select
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                  >
                    <option value="all">Toàn quốc</option>
                    {vietnamProvinces.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </span>
              </label>
              <div className="filter-group">
                <span>Hình thức giao dịch</span>
                <div className="filter-options compact">
                  <button
                    className={shipping === "all" ? "active" : ""}
                    onClick={() => setShipping("all")}
                  >
                    Tất cả
                  </button>
                  <button
                    className={shipping === "yes" ? "active" : ""}
                    onClick={() => setShipping("yes")}
                  >
                    Có ship
                  </button>
                  <button
                    className={shipping === "no" ? "active" : ""}
                    onClick={() => setShipping("no")}
                  >
                    GDTT
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="listings-section">
          <div className="listings-toolbar">
            <div>
              <span className="section-kicker">SẢN PHẨM PHÙ HỢP</span>
              <h2>Được cộng đồng đăng gần đây</h2>
              <p>
                {productCount} sản phẩm trong {orderCount} đơn đang chờ bạn khám
                phá
              </p>
            </div>
            <div className="listing-actions">
              <label>
                Sắp xếp{" "}
                <span className="select-wrap">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="price_asc">Giá tăng dần</option>
                    <option value="price_desc">Giá giảm dần</option>
                  </select>
                  <ChevronDown size={14} />
                </span>
              </label>
            </div>
          </div>
          {loading ? (
            <div className="empty-state">
              <LoaderCircle className="spin" />
              <h3>Đang tải sản phẩm</h3>
            </div>
          ) : loadError ? (
            <div className="empty-state">
              <Search />
              <h3>Không thể tải sản phẩm</h3>
              <p>Vui lòng thử lại sau.</p>
            </div>
          ) : listingGroups.length ? (
            <div className="listing-grid">
              {listingGroups.map((items) => (
                <ListingCard
                  key={items[0].orderCode ?? items[0].id}
                  item={items[0]}
                  orderItems={items}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search />
              <h3>Chưa có sản phẩm phù hợp</h3>
              <p>Không có bài đăng thật nào khớp với bộ lọc hiện tại.</p>
            </div>
          )}
        </section>

        <section className="community-banner">
          <div>
            <span className="section-kicker light">TIN CẬY & TỬ TẾ</span>
            <h2>
              Không chỉ là mua bán.
              <br />
              Đây là cộng đồng.
            </h2>
            <p>
              Mọi bài đăng đều công khai giá, có hình ảnh rõ ràng và được cộng
              đồng cùng nhau giữ gìn.
            </p>
            <div className="admin-profile-card">
              <Image
                src="/brand/admin-profile.png"
                alt="Admin cộng đồng Cuồng Tai Nghe TWS"
                width={58}
                height={58}
              />
              <span>
                <small>ADMIN CỘNG ĐỒNG</small>
                <strong>Luôn sẵn sàng hỗ trợ</strong>
                <em>Báo cáo nội dung · Hỗ trợ giao dịch</em>
              </span>
              <a
                href={ADMIN_FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Liên hệ Facebook ↗
              </a>
            </div>
          </div>
          <div className="banner-values">
            <div>
              <b>01</b>
              <span>
                <strong>Minh bạch</strong>
                <small>Giá và tình trạng rõ ràng</small>
              </span>
            </div>
            <div>
              <b>02</b>
              <span>
                <strong>An tâm</strong>
                <small>Admin hỗ trợ miễn phí</small>
              </span>
            </div>
            <div>
              <b>03</b>
              <span>
                <strong>Bền vững</strong>
                <small>Cho món đồ vòng đời mới</small>
              </span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
