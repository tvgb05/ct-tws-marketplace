"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  Camera,
  ImagePlus,
  Info,
  LoaderCircle,
  PackagePlus,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatPrice, formatPriceInput, parsePriceInput } from "@/lib/format";
import { categories } from "@/lib/marketplace-taxonomy";
import { vietnamProvinces } from "@/lib/vietnam-provinces";
import { useAuth } from "@/lib/auth";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type ItemDraft = {
  id: string;
  title: string;
  price: string;
  quantity: string;
  category: string;
  subcategory: string;
  condition: "NEW" | "USED";
};

type UploadedImage = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
};

type ApiCategory = { id: string; slug: string; name: string };

const emptyItem = (): ItemDraft => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title: "",
  price: "",
  quantity: "1",
  category: "",
  subcategory: "",
  condition: "USED",
});

export function NewListingForm() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [description, setDescription] = useState("");
  const [province, setProvince] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<
    "MEETUP" | "SHIPPING" | "BOTH"
  >("BOTH");
  const [allowAdminMediation, setAllowAdminMediation] = useState(true);
  const [sellerPolicyAccepted, setSellerPolicyAccepted] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionNotice, setSubmissionNotice] = useState("");

  useEffect(() => {
    void fetch(`${apiUrl}/categories`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setApiCategories((await response.json()) as ApiCategory[]);
      })
      .catch(() =>
        setSubmissionNotice("Không thể tải danh mục. Vui lòng thử lại."),
      );
  }, []);

  const categoryIdBySlug = useMemo(
    () =>
      new Map(apiCategories.map((category) => [category.slug, category.id])),
    [apiCategories],
  );

  if (user && !user.canPostListings) {
    return (
      <main className="listing-form-page">
        <section className="posting-restricted-notice">
          <AlertTriangle size={34} />
          <span className="section-kicker">
            QUYỀN ĐĂNG BÀI ĐANG BỊ TẠM KHÓA
          </span>
          <h1>Bạn chưa thể đăng sản phẩm mới.</h1>
          <p>
            {user.postingRestrictionReason ||
              "Admin đã tạm khóa quyền đăng bài do vi phạm quy tắc cộng đồng."}
          </p>
          <p>
            Bạn vẫn có thể đăng nhập, theo dõi giao dịch hiện tại và liên hệ
            admin nếu cho rằng quyết định này cần được xem xét lại.
          </p>
          <Link className="button button-primary" href="/community-guidelines">
            Xem quy tắc và liên hệ admin
          </Link>
        </section>
      </main>
    );
  }

  const updateItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const changeMode = (nextMode: "single" | "batch") => {
    setMode(nextMode);
    setItems((current) =>
      nextMode === "single"
        ? [current[0] ?? emptyItem()]
        : current.length >= 2
          ? current
          : [...current, emptyItem()],
    );
  };

  const validateStepOne = () => {
    if (
      items.some(
        (item) =>
          item.title.trim().length < 5 ||
          !item.category ||
          !item.subcategory ||
          !item.price ||
          Number(item.price) < 1 ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1,
      )
    )
      return "Vui lòng nhập đủ tên, danh mục, tình trạng và giá của từng món.";
    if (description.trim().length < 20)
      return "Mô tả chung cần có ít nhất 20 ký tự.";
    if (!province) return "Vui lòng chọn tỉnh hoặc thành phố.";
    if (apiCategories.length === 0)
      return "Danh mục chưa tải xong. Vui lòng đợi một chút.";
    return "";
  };

  const nextStep = () => {
    const error =
      step === 1
        ? validateStepOne()
        : images.length === 0
          ? "Vui lòng tải ít nhất một ảnh thật."
          : "";
    if (error) {
      setSubmissionNotice(error);
      return;
    }
    setSubmissionNotice("");
    setStep((current) => Math.min(3, current + 1));
  };

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).slice(
      0,
      8 - images.length,
    );
    event.target.value = "";
    if (!selected.length) return;
    const invalid = selected.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 8 * 1024 * 1024,
    );
    if (invalid) {
      setSubmissionNotice("Chỉ nhận JPEG, PNG, WebP và tối đa 8 MB mỗi ảnh.");
      return;
    }
    setUploading(true);
    setSubmissionNotice("");
    try {
      const uploaded: UploadedImage[] = [];
      for (const file of selected) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(`${apiUrl}/listings/images`, {
          method: "POST",
          credentials: "include",
          body,
        });
        const result = (await response.json()) as UploadedImage & {
          message?: string;
        };
        if (!response.ok)
          throw new Error(result.message ?? `Không thể tải ảnh ${file.name}`);
        uploaded.push(result);
      }
      setImages((current) => [...current, ...uploaded]);
    } catch (error) {
      setSubmissionNotice(
        error instanceof Error ? error.message : "Không thể tải ảnh lên.",
      );
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) {
      nextStep();
      return;
    }
    if (!sellerPolicyAccepted) {
      setSubmissionNotice("Bạn cần xác nhận cam kết cộng đồng trước khi đăng.");
      return;
    }
    const location = vietnamProvinces.find(
      (item) => item.code === province,
    )?.label;
    if (!location) return;
    const normalizedItems = items.map((item) => ({
      title: item.title.trim(),
      price: Number(item.price),
      quantity: Number(item.quantity),
      categoryId: categoryIdBySlug.get(item.category),
      subcategory: item.subcategory,
      condition: item.condition,
    }));
    if (normalizedItems.some((item) => !item.categoryId)) {
      setSubmissionNotice(
        "Danh mục đã thay đổi. Vui lòng quay lại chọn lại danh mục.",
      );
      return;
    }
    const common = {
      description: description.trim(),
      location,
      deliveryMethod,
      allowAdminMediation,
      images,
      sellerPolicyAccepted,
    };
    const payload =
      mode === "batch"
        ? { ...common, items: normalizedItems }
        : { ...common, ...normalizedItems[0] };
    setSubmitting(true);
    setSubmissionNotice("");
    try {
      const response = await fetch(
        `${apiUrl}/listings${mode === "batch" ? "/batch" : ""}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as
        | { slug?: string; message?: string | string[] }
        | Array<{ slug: string }>;
      if (!response.ok) {
        const message = !Array.isArray(result) ? result.message : undefined;
        throw new Error(
          Array.isArray(message)
            ? message.join(" ")
            : (message ?? "Không thể tạo bài đăng."),
        );
      }
      const slug = Array.isArray(result) ? result[0]?.slug : result.slug;
      router.push(slug ? `/marketplace/${slug}` : "/account/listings");
      router.refresh();
    } catch (error) {
      setSubmissionNotice(
        error instanceof Error ? error.message : "Không thể tạo bài đăng.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="form-page">
      <div className="form-heading">
        <span className="section-kicker">ĐĂNG BÁN SẢN PHẨM</span>
        <h1>Một ảnh chung, từng món vẫn dễ tìm.</h1>
        <p>
          Khai báo riêng từng món trong ảnh để hệ thống tạo bài, giá và trạng
          thái giao dịch độc lập.
        </p>
      </div>
      <div className="steps">
        <span className={step >= 1 ? "active" : ""}>
          <b>1</b>Danh sách món
        </span>
        <i />
        <span className={step >= 2 ? "active" : ""}>
          <b>2</b>Ảnh chung & giao nhận
        </span>
        <i />
        <span className={step >= 3 ? "active" : ""}>
          <b>3</b>Xác nhận
        </span>
      </div>
      <form className="listing-form" onSubmit={submit}>
        <div className="form-card">
          {step === 1 && (
            <>
              <div className="form-card-title">
                <span>01</span>
                <div>
                  <h2>Bạn đang pass bao nhiêu món?</h2>
                  <p>
                    Mỗi dòng sẽ thành một bài riêng nhưng cùng sử dụng bộ ảnh đã
                    tải.
                  </p>
                </div>
              </div>
              <div className="listing-mode-picker">
                <button
                  type="button"
                  className={mode === "single" ? "active" : ""}
                  onClick={() => changeMode("single")}
                >
                  <ImagePlus size={19} />
                  <span>
                    <strong>Một món</strong>
                    <small>Đăng bán như thông thường</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={mode === "batch" ? "active" : ""}
                  onClick={() => changeMode("batch")}
                >
                  <PackagePlus size={19} />
                  <span>
                    <strong>Nhiều món chung ảnh</strong>
                    <small>Mỗi món có tên và giá riêng</small>
                  </span>
                </button>
              </div>
              {mode === "batch" && (
                <div className="shared-photo-explainer">
                  <Info size={17} />
                  <span>
                    <strong>Không cần đăng lại cùng một ảnh nhiều lần.</strong>
                    <small>
                      Tìm “sạc dự phòng” vẫn ra đúng món đó; khi bán xong chỉ
                      món đó chuyển trạng thái.
                    </small>
                  </span>
                </div>
              )}
              <div className="batch-item-list">
                {items.map((item, index) => {
                  const availableSubcategories =
                    categories.find(
                      (category) => category.slug === item.category,
                    )?.subcategories ?? [];
                  return (
                    <section className="batch-item" key={item.id}>
                      <header>
                        <b>Món {index + 1}</b>
                        {mode === "batch" && items.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setItems((current) =>
                                current.filter((entry) => entry.id !== item.id),
                              )
                            }
                          >
                            <Trash2 size={15} /> Xóa
                          </button>
                        )}
                      </header>
                      <div className="form-grid">
                        <label className="field field-full">
                          <span>Tên cụ thể *</span>
                          <input
                            required
                            minLength={5}
                            maxLength={120}
                            value={item.title}
                            onChange={(event) =>
                              updateItem(item.id, { title: event.target.value })
                            }
                            placeholder="Ví dụ: Sạc dự phòng Anker 10.000 mAh"
                          />
                          <small>{item.title.length}/120</small>
                        </label>
                        <label className="field">
                          <span>Danh mục *</span>
                          <select
                            required
                            value={item.category}
                            onChange={(event) =>
                              updateItem(item.id, {
                                category: event.target.value,
                                subcategory: "",
                              })
                            }
                          >
                            <option value="" disabled>
                              Chọn danh mục
                            </option>
                            {categories
                              .filter((category) => category.slug !== "all")
                              .map((category) => (
                                <option
                                  key={category.slug}
                                  value={category.slug}
                                >
                                  {category.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Danh mục con *</span>
                          <select
                            required
                            disabled={!item.category}
                            value={item.subcategory}
                            onChange={(event) =>
                              updateItem(item.id, {
                                subcategory: event.target.value,
                              })
                            }
                          >
                            <option value="" disabled>
                              {item.category
                                ? "Chọn danh mục con"
                                : "Chọn danh mục lớn trước"}
                            </option>
                            {availableSubcategories.map((subcategory) => (
                              <option
                                key={subcategory.slug}
                                value={subcategory.slug}
                              >
                                {subcategory.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Tình trạng *</span>
                          <div className="segment">
                            <label>
                              <input
                                type="radio"
                                name={`condition-${item.id}`}
                                checked={item.condition === "NEW"}
                                onChange={() =>
                                  updateItem(item.id, { condition: "NEW" })
                                }
                              />
                              <span>Mới</span>
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`condition-${item.id}`}
                                checked={item.condition === "USED"}
                                onChange={() =>
                                  updateItem(item.id, { condition: "USED" })
                                }
                              />
                              <span>Đã dùng</span>
                            </label>
                          </div>
                        </label>
                        <label className="field">
                          <span>Giá riêng *</span>
                          <div className="input-suffix">
                            <input
                              required
                              type="text"
                              inputMode="numeric"
                              value={formatPriceInput(item.price)}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  price: parsePriceInput(event.target.value),
                                })
                              }
                              placeholder="0"
                            />
                            <b>VNĐ</b>
                          </div>
                        </label>
                        <label className="field">
                          <span>Số lượng đang có *</span>
                          <div className="input-suffix">
                            <input
                              required
                              type="number"
                              min="1"
                              max="9999"
                              step="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  quantity: event.target.value,
                                })
                              }
                            />
                            <b>cái</b>
                          </div>
                        </label>
                      </div>
                    </section>
                  );
                })}
              </div>
              {mode === "batch" && items.length < 20 && (
                <button
                  type="button"
                  className="add-batch-item"
                  onClick={() =>
                    setItems((current) => [...current, emptyItem()])
                  }
                >
                  <Plus size={16} /> Thêm một món khác
                </button>
              )}
              <div className="form-grid common-listing-fields">
                <label className="field">
                  <span>Tỉnh / thành phố *</span>
                  <select
                    required
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                  >
                    <option value="" disabled>
                      Chọn tỉnh / thành phố
                    </option>
                    {vietnamProvinces.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field field-full">
                  <span>Mô tả chung *</span>
                  <textarea
                    required
                    minLength={20}
                    rows={5}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tình trạng tổng thể, phụ kiện đi kèm, cách nhận biết từng món trong ảnh…"
                  />
                  <small>{description.length}/5000</small>
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="form-card-title">
                <span>02</span>
                <div>
                  <h2>
                    {mode === "batch"
                      ? "Ảnh chung của tất cả món"
                      : "Hình ảnh sản phẩm"}
                  </h2>
                  <p>
                    Ảnh đầu tiên là ảnh bìa. Có thể thêm ảnh cận cảnh nếu cần.
                  </p>
                </div>
              </div>
              <input
                ref={fileInput}
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => void uploadImages(event)}
              />
              <div
                className="upload-area"
                onClick={() => !uploading && fileInput.current?.click()}
              >
                {uploading ? (
                  <LoaderCircle className="spin" size={31} />
                ) : (
                  <ImagePlus size={31} />
                )}
                <strong>
                  {uploading
                    ? "Đang tải ảnh…"
                    : mode === "batch"
                      ? "Tải ảnh chụp chung"
                      : "Thêm ảnh sản phẩm"}
                </strong>
                <p>JPEG, PNG, WebP · tối đa 8 MB/ảnh · tối đa 8 ảnh</p>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={uploading || images.length >= 8}
                >
                  <Camera size={16} /> Chọn ảnh
                </button>
              </div>
              {images.length > 0 && (
                <div className="uploaded-image-grid">
                  {images.map((image, index) => (
                    <figure key={image.publicId}>
                      <img src={image.secureUrl} alt={`Ảnh ${index + 1}`} />
                      {index === 0 && <b>Ảnh bìa</b>}
                      <button
                        type="button"
                        aria-label="Xóa ảnh"
                        onClick={() =>
                          setImages((current) =>
                            current.filter(
                              (entry) => entry.publicId !== image.publicId,
                            ),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </figure>
                  ))}
                </div>
              )}
              <div className="form-grid">
                <label className="field field-full">
                  <span>Phương thức giao nhận *</span>
                  <select
                    value={deliveryMethod}
                    onChange={(event) =>
                      setDeliveryMethod(
                        event.target.value as typeof deliveryMethod,
                      )
                    }
                  >
                    <option value="BOTH">Gặp trực tiếp hoặc giao hàng</option>
                    <option value="MEETUP">Chỉ gặp trực tiếp (GDTT)</option>
                    <option value="SHIPPING">Giao hàng toàn quốc</option>
                  </select>
                </label>
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={allowAdminMediation}
                  onChange={(event) =>
                    setAllowAdminMediation(event.target.checked)
                  }
                />
                <span>
                  <strong>Cho phép admin hỗ trợ trung gian</strong>
                  <small>
                    Người mua có thể gửi yêu cầu nhờ admin cộng đồng hỗ trợ giao
                    dịch miễn phí.
                  </small>
                </span>
                <ShieldCheck />
              </label>
            </>
          )}
          {step === 3 && (
            <>
              <div className="form-card-title">
                <span>03</span>
                <div>
                  <h2>Kiểm tra & xác nhận</h2>
                  <p>
                    {mode === "batch"
                      ? `${items.length} bài riêng sẽ được tạo từ cùng bộ ảnh.`
                      : "Đảm bảo thông tin trung thực trước khi đăng."}
                  </p>
                </div>
              </div>
              <div className="preview-card">
                <div>
                  {images[0] ? (
                    <img
                      className="preview-image"
                      src={images[0].secureUrl}
                      alt="Ảnh xem trước"
                    />
                  ) : (
                    <span className="preview-placeholder">
                      <ImagePlus />
                    </span>
                  )}
                </div>
                <section>
                  <small>XEM TRƯỚC BÀI ĐĂNG</small>
                  <h3>
                    {mode === "batch"
                      ? `${items.length} món dùng chung ảnh`
                      : items[0].title}
                  </h3>
                  <strong>
                    {mode === "batch"
                      ? `Từ ${formatPrice(Math.min(...items.map((item) => Number(item.price))))}`
                      : formatPrice(Number(items[0].price))}
                  </strong>
                  <p>{description}</p>
                </section>
              </div>
              {mode === "batch" && (
                <div className="batch-review-list">
                  {items.map((item, index) => (
                    <div key={item.id}>
                      <b>{index + 1}</b>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {
                            categories.find(
                              (category) => category.slug === item.category,
                            )?.label
                          }{" "}
                          · {item.quantity} sản phẩm
                        </small>
                      </span>
                      <em>{formatPrice(Number(item.price))}</em>
                    </div>
                  ))}
                </div>
              )}
              <label className="policy-check">
                <input
                  required
                  type="checkbox"
                  checked={sellerPolicyAccepted}
                  onChange={(event) =>
                    setSellerPolicyAccepted(event.target.checked)
                  }
                />
                <span>
                  <strong>
                    Tôi xác nhận thông tin và ảnh chụp phản ánh đúng các món
                    đang bán
                  </strong>
                  <small>
                    Mỗi món có giá và trạng thái giao dịch độc lập; tôi chịu
                    trách nhiệm cập nhật khi món không còn bán.
                  </small>
                </span>
              </label>
              <div className="form-tip">
                <Info size={17} />{" "}
                {mode === "batch"
                  ? `Hệ thống sẽ tạo ${items.length} bài để từng món xuất hiện đúng trong kết quả tìm kiếm.`
                  : "Bài đăng mới sẽ được công khai ngay."}
              </div>
            </>
          )}
          {submissionNotice && (
            <p className="profile-setup-error" role="alert">
              {submissionNotice}
            </p>
          )}
          <div className="form-actions">
            {step > 1 && (
              <button
                type="button"
                className="button button-ghost"
                disabled={submitting}
                onClick={() => {
                  setSubmissionNotice("");
                  setStep((current) => current - 1);
                }}
              >
                Quay lại
              </button>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={submitting || uploading}
            >
              {submitting && <LoaderCircle className="spin" size={16} />}
              {step === 3
                ? mode === "batch"
                  ? `Đăng ${items.length} món`
                  : "Đăng sản phẩm"
                : "Tiếp tục"}
            </button>
          </div>
        </div>
        <aside className="form-aside">
          <ShieldCheck />
          <h3>Mẹo chụp nhiều món</h3>
          <ul>
            <li>Xếp các món không che nhau</li>
            <li>Đánh số vị trí nếu hình dễ nhầm</li>
            <li>Ghi đúng tên/model từng món</li>
            <li>Thêm ảnh cận cảnh lỗi ngoại hình</li>
          </ul>
          <Link href="/community-guidelines">Xem quy tắc cộng đồng →</Link>
        </aside>
      </form>
    </main>
  );
}
