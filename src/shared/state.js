// App state that needs to be shared across modules

export let isLoading = false;
export let lastGeneratedImageUrl = null;
export let generatedImagesHistory = [];

// Functions to modify state to avoid direct mutation from everywhere
export function setIsLoading(loading) {
    isLoading = loading;
}
export function setLastGeneratedImageUrl(url) {
    lastGeneratedImageUrl = url;
}
export function addGeneratedImageToHistory(url) {
     if (url && !generatedImagesHistory.some(item => item.url === url)) {
        generatedImagesHistory.unshift({ id: `hist-${Date.now()}`, url });
     }
}

// Face prompt constant - The highest quality version
export const FACE_PROMPT_TEXT = `
** HOÀN TOÀN TUÂN THỦ: SỬ DỤNG HÌNH ẢNH TẢI LÊN LÀM SỰ THAM KHẢO CHÍNH XÁC NHẤT CHO KHUÔN MẶT.** Phân tích các đặc điểm nhận dạng khuôn mặt từ hình ảnh đầu vào. Luôn xác định: Giới tính, tuổi, dân tộc/vùng miền. 
Hình dạng tổng thể khuôn mặt(hình bầu dục, hình trái tim, hình tròn, hình vuông...). 
Da: (tông màu, kết cấu, ánh sáng). 
Mắt: (hình dáng, mí, màu sắc, ánh nhìn). 
Mũi: (sống mũi, đầu mũi, cánh mũi). 
Miệng: (độ dày, môi màu, độ cong)
Cằm & hàm: (V-line, oval, vuông nhẹ…). 
Đặc điểm cố định: (nốt ruồi, sẹo, răng khểnh,... nếu có). 
Ghi nhớ các đặc điểm đó và tái tạo lại khuôn mặt CHÍNH XÁC TUYỆT ĐỐI so với ảnh đầu vào và phù hợp với ánh sáng, phong cách của ảnh đầu ra. 
HOÀN TOÀN KHÔNG thay đổi đường nét khuôn mặt, mắt, mũi, miệng. 
Chân dung studio chân thực. Da thể hiện các kết cấu vi mô mịn màng và độ phân tán bề mặt tinh tế; đôi mắt sắc nét; đường chân tóc hòa quyện hoàn hảo với các sợi riêng lẻ và tóc bay tự nhiên. Ánh sáng phù hợp với cảnh; bóng đổ tự nhiên trên xương gò má, xương hàm và mũi. Nhấn mạnh: khuôn mặt đồng nhất, giữ nguyên các đặc điểm riêng biệt: mắt, môi, đường viền hàm, chi tiết khuôn mặt siêu trung thực, da mịn màng, kết cấu vi mô và lông tơ như da người thật, mắt sắc nét. Chỉ trả về kết quả bằng hình ảnh.`;
