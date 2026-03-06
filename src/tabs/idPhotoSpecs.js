/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This file contains detailed, technical specifications for generating compliant ID photos
// for various countries and document types. The 'requirements' property is a crucial prompt
// that instructs the AI to act as a technical image processor and adhere to strict
// geometric rules, ensuring a much higher success rate than simple text prompts.

const schengenSpec = {
    aspectRatio: '7 / 9', // 3.5cm / 4.5cm
    requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh visa hợp lệ cho Khu vực Schengen.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây. Những quy tắc này là ưu tiên tuyệt đối.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ khung hình 7:9 (rộng:cao) hoàn hảo.
2.  **Tách và Tỷ lệ Đầu:** Xác định đầu của đối tượng (từ đáy cằm đến đỉnh tóc). Cắt lại và điều chỉnh tỷ lệ của người đó sao cho chiều cao của đầu này chiếm **từ 70% đến 80%** tổng chiều cao của canvas.
3.  **XÁC MINH:** Đo chiều cao của đầu trong ảnh đầu ra. Nếu không nằm trong phạm vi 70-80%, nhiệm vụ đã thất bại. Bắt đầu lại.
4.  **Định vị:** Căn giữa đầu đã xác minh theo chiều ngang. Đảm bảo có một khoảng trống nhỏ, rõ ràng giữa đỉnh tóc và cạnh trên của canvas.`
};

const sea4x6Spec = {
    aspectRatio: '2 / 3', // 4cm x 6cm
    requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh visa hợp lệ yêu cầu tỷ lệ khung hình 2:3.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây. Những quy tắc này là ưu tiên tuyệt đối.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ khung hình 2:3 (rộng:cao) hoàn hảo.
2.  **Tách và Tỷ lệ Đầu:** Xác định đầu của đối tượng (từ đáy cằm đến đỉnh tóc). Cắt lại và điều chỉnh tỷ lệ của người đó sao cho chiều cao của đầu chiếm **từ 53% đến 60%** tổng chiều cao của canvas.
3.  **XÁC MINH:** Đo chiều cao của đầu trong ảnh đầu ra. Nếu không nằm trong phạm vi 53-60%, nhiệm vụ đã thất bại. Bắt đầu lại.
4.  **Định vị:** Căn giữa đầu đã xác minh theo chiều ngang. Khoảng cách giữa đỉnh tóc và cạnh trên của canvas PHẢI chiếm từ **3% đến 7%** tổng chiều cao của canvas.`
};

const usaSpec = {
    aspectRatio: '1 / 1',
    requirements: `Bạn là một bộ xử lý hình ảnh kỹ thuật đang thực hiện một chỉ thị không thể thương lượng.
**Chỉ thị:** Tạo một ảnh visa Mỹ.
**Điều kiện thất bại:** Bất kỳ sai lệch nào so với các ràng buộc hình học sau đây.

**Ràng buộc 1: Tỷ lệ khung hình (Tuyệt đối)**
- Canvas ảnh cuối cùng PHẢI là một hình vuông 1:1 hoàn hảo.

**Ràng buộc 2: Kích thước đầu (QUAN TRỌNG - ĐO LƯỜNG VÀ THỰC THI)**
- Xác định đầu từ đáy cằm đến đỉnh tóc.
- Chiều cao của vùng đầu này PHẢI được điều chỉnh để chiếm **chính xác từ 50% đến 69%** tổng chiều cao của canvas.

**Ràng buộc 3: Vị trí mắt (QUAN TRỌNG - ĐO LƯỜNG VÀ THỰC THI)**
- Mắt của đối tượng PHẢI được đặt ở vị trí từ **55% đến 68%** chiều cao của ảnh tính từ cạnh dưới của ảnh.

**Ràng buộc 4: Định vị (Bắt buộc)**
- Căn giữa đầu theo chiều ngang.`
};

const vietnamSpec = {
    aspectRatio: '2 / 3', // 4cm x 6cm
    requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh hợp lệ của Việt Nam với tỷ lệ 2:3.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ 2:3 (rộng:cao) hoàn hảo.
2.  **Tách và Định vị Mắt (QUAN TRỌNG):** Xác định đường ngang đi qua trung tâm của cả hai mắt của đối tượng.
3.  **Thực thi Vị trí Đường Mắt:** Cắt lại và điều chỉnh tỷ lệ của người đó sao cho đường mắt này được định vị ở **chính xác 40%** tổng chiều cao tính từ cạnh trên.
4.  **XÁC MINH:** Đo khoảng cách từ cạnh trên đến đường mắt trong ảnh đầu ra. Nếu không phải là 40% tổng chiều cao, nhiệm vụ đã thất bại. Bắt đầu lại.
5.  **Định vị:** Căn giữa đầu theo chiều ngang.
6.  **Kích thước Đầu (Hướng dẫn):** Sau khi định vị đường mắt, đảm bảo đầu (từ cằm đến đỉnh tóc) có tỷ lệ tự nhiên. Chiều cao của nó thường nên chiếm từ **50% đến 60%** tổng chiều cao của canvas.`
};

const common3x4Spec = {
    aspectRatio: '3 / 4', // 3cm x 4cm
    requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh thẻ tiêu chuẩn với tỷ lệ 3:4.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ 3:4 (rộng:cao) hoàn hảo.
2.  **Tách và Tỷ lệ Đầu:** Xác định đầu của đối tượng (từ đáy cằm đến đỉnh tóc). Cắt lại và điều chỉnh tỷ lệ của người đó sao cho chiều cao của đầu chiếm từ **60% đến 75%** tổng chiều cao của canvas.
3.  **Định vị:** Căn giữa đầu theo chiều ngang. Khoảng cách giữa đỉnh tóc và cạnh trên của canvas nên vào khoảng **5% đến 10%** tổng chiều cao của canvas.
4.  **Xác minh:** Điều chỉnh tỷ lệ và định vị để đáp ứng cả hai quy tắc về kích thước đầu và định vị.`
};

const common2x3Spec = {
    aspectRatio: '2 / 3', // 2cm x 3cm
    requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh thẻ tiêu chuẩn với tỷ lệ 2:3.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ 2:3 (rộng:cao) hoàn hảo.
2.  **Tách và Tỷ lệ Đầu:** Xác định đầu của đối tượng (từ đáy cằm đến đỉnh tóc). Cắt lại và điều chỉnh tỷ lệ của người đó sao cho chiều cao của đầu chiếm từ **65% đến 80%** tổng chiều cao của canvas.
3.  **Định vị:** Căn giữa đầu theo chiều ngang. Khoảng cách giữa đỉnh tóc và cạnh trên của canvas nên vào khoảng **5% đến 10%** tổng chiều cao của canvas.
4.  **Xác minh:** Điều chỉnh tỷ lệ và định vị để đáp ứng cả hai quy tắc về kích thước đầu và định vị.`
};

export const PHOTO_SPEC_OPTIONS = [
    // Common Sizes
    {
        id: 'common-2x3', country: 'Kích thước phổ thông', docType: 'Ảnh 2x3',
        widthCm: 2.0, heightCm: 3.0, ...common2x3Spec
    },
     {
        id: 'common-3x4', country: 'Kích thước phổ thông', docType: 'Ảnh 3x4',
        widthCm: 3.0, heightCm: 4.0, ...common3x4Spec
    },
    {
        id: 'common-4x6', country: 'Kích thước phổ thông', docType: 'Ảnh 4x6',
        widthCm: 4.0, heightCm: 6.0, ...sea4x6Spec
    },
    // USA
    {
        id: 'us-passport-visa-5.1x5.1', country: 'Mỹ (USA)', docType: 'Hộ chiếu / Visa',
        widthCm: 5.1, heightCm: 5.1, ...usaSpec
    },
    // Vietnam
    {
        id: 'vn-passport-visa-4x6', country: 'Việt Nam', docType: 'Hộ chiếu / Visa',
        widthCm: 4.0, heightCm: 6.0, ...vietnamSpec
    },
    {
        id: 'vn-chip-id-trc-2x3', country: 'Việt Nam', docType: 'CCCD / Thẻ tạm trú',
        widthCm: 2.0, heightCm: 3.0, ...common2x3Spec
    },
    {
        id: 'vn-id-card-3x4', country: 'Việt Nam', docType: 'CMND cũ',
        widthCm: 3.0, heightCm: 4.0, ...common3x4Spec
    },
    // Japan
    {
        id: 'jp-passport-visa-3.5x4.5', country: 'Nhật Bản', docType: 'Hộ chiếu / Visa',
        widthCm: 3.5, heightCm: 4.5, ...schengenSpec
    },
     // South Korea
    {
        id: 'kr-passport-visa-3.5x4.5', country: 'Hàn Quốc', docType: 'Hộ chiếu / Visa',
        widthCm: 3.5, heightCm: 4.5, ...schengenSpec
    },
    // China
    {
        id: 'cn-passport-visa-3.3x4.8', country: 'Trung Quốc', docType: 'Hộ chiếu / Visa',
        widthCm: 3.3, heightCm: 4.8, 
        aspectRatio: '33 / 48',
        requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh hộ chiếu/visa hợp lệ của Trung Quốc.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ 33:48 (rộng:cao) hoàn hảo.
2.  **Tách và Tỷ lệ Đầu:** Xác định đầu của đối tượng (từ cằm đến đỉnh tóc). Chiều rộng của đầu cũng phải được xem xét.
3.  **Chiều cao đầu:** Điều chỉnh tỷ lệ người sao cho chiều cao đầu nằm trong khoảng **58% đến 69%** tổng chiều cao canvas.
4.  **Chiều rộng đầu:** Chiều rộng của đầu phải nằm trong khoảng **45% đến 67%** tổng chiều rộng canvas.
5.  **Lề trên:** Khoảng cách từ đỉnh đầu đến cạnh trên của ảnh phải nằm trong khoảng **6% đến 10%** tổng chiều cao canvas.
6.  **Lề dưới:** Khoảng cách từ cằm đến cạnh dưới phải ít nhất là **14.5%** tổng chiều cao canvas.
7.  **Xác minh:** Điều chỉnh tỷ lệ và định vị để đáp ứng TẤT CẢ BỐN ràng buộc kích thước trên đồng thời. Căn giữa đầu theo chiều ngang.`
    },
    // Schengen Area
    {
        id: 'schengen-visa-3.5x4.5', country: 'Khu vực Schengen', docType: 'Visa',
        widthCm: 3.5, heightCm: 4.5, ...schengenSpec
    },
    // Canada
    {
        id: 'ca-passport-visa-5x7', country: 'Canada', docType: 'Hộ chiếu / Visa',
        widthCm: 5.0, heightCm: 7.0, 
        aspectRatio: '5 / 7',
        requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh hộ chiếu/visa hợp lệ của Canada.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ 5:7 (rộng:cao) hoàn hảo.
2.  **Tách và Định nghĩa Đầu:** Xác định đầu của đối tượng từ đáy cằm đến **đỉnh sọ (bỏ qua phần tóc phồng)**.
3.  **Thực thi Kích thước Đầu (QUAN TRỌNG):** Cắt lại và điều chỉnh tỷ lệ của người đó sao cho chiều cao đầu (cằm đến đỉnh sọ) nằm trong khoảng **44% đến 51%** tổng chiều cao canvas.
4.  **XÁC MINH:** Đo khoảng cách cằm-đến-đỉnh sọ trong ảnh đầu ra. Nếu không nằm trong phạm vi 44-51% của chiều cao canvas, nhiệm vụ đã thất bại. Bắt đầu lại.
5.  **Khung hình:** Ảnh cuối cùng PHẢI là ảnh chân dung toàn bộ đầu và phần vai trên. Cả hai vai phải sichtbar.
6.  **Định vị:** Căn giữa đầu theo chiều ngang. Khuôn mặt và vai phải được căn giữa trong ảnh.`
    },
    // Australia
    {
        id: 'au-passport-visa-3.5x4.5', country: 'Úc (Australia)', docType: 'Hộ chiếu / Visa',
        widthCm: 3.5, heightCm: 4.5, 
        aspectRatio: '7 / 9',
        requirements: `**CHỈ THỊ KỸ THUẬT BẮT BUỘC CHO BỘ XỬ LÝ HÌNH ẢNH**
**NHIỆM VỤ:** Bố cục lại hình ảnh nguồn thành một ảnh hộ chiếu/visa hợp lệ của Úc.
**ĐIỀU KIỆN THẤT BẠI:** Hình ảnh đầu ra không tuân thủ nghiêm ngặt TẤT CẢ các quy tắc hình học dưới đây.

**QUY TRÌNH:**
1.  **Thiết lập Canvas:** Canvas ảnh cuối cùng PHẢI có tỷ lệ 7:9 (rộng:cao) hoàn hảo.
2.  **Tách và Định nghĩa Đầu:** Xác định đầu của đối tượng từ đáy cằm đến **đỉnh sọ (bỏ qua phần tóc phồng)**.
3.  **Thực thi Kích thước Đầu (QUAN TRỌNG):** Cắt lại và điều chỉnh tỷ lệ của người đó sao cho chiều cao đầu (cằm đến đỉnh sọ) nằm trong khoảng **71% đến 80%** tổng chiều cao canvas.
4.  **XÁC MINH:** Đo khoảng cách cằm-đến-đỉnh sọ trong ảnh đầu ra. Nếu không nằm trong phạm vi 71-80% của chiều cao canvas, nhiệm vụ đã thất bại. Bắt đầu lại.
5.  **Định vị:** Căn giữa đầu theo chiều ngang. Đảm bảo có một khoảng trống đồng đều, rõ ràng giữa đỉnh sọ và cạnh trên của ảnh.`
    },
].sort((a, b) => a.country.localeCompare(b.country) || a.docType.localeCompare(b.docType));
