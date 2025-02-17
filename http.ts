import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// 定义请求配置接口
interface RequestConfig extends AxiosRequestConfig {
  // 可选的取消令牌
  cancelToken?: any;
}

// 定义响应数据接口
interface ResponseData<T = any> {
  code: number;
  message: string;
  data: T;
}

// 定义自定义错误接口
interface CustomAxiosError extends AxiosError {
  isCanceled?: boolean;
}

class HttpClient {
  private pendingRequests: Map<string, AbortController>;

  constructor() {
    this.pendingRequests = new Map();
  }

  // 生成唯一的请求标识符
  private getRequestId(config: RequestConfig): string {
    const { method, url, params, data } = config;
    return JSON.stringify({ method, url, params, data });
  }

  // 取消所有未完成的请求
  public cancelAllPendingRequests(): void {
    this.pendingRequests.forEach((controller, requestId) => {
      controller.abort();
      this.pendingRequests.delete(requestId);
    });
  }

  // 发送请求
  public async request<T>(config: RequestConfig): Promise<ResponseData<T>> {
    const requestId = this.getRequestId(config);

    // 如果已经有相同的请求在进行中，则取消之前的请求
    if (this.pendingRequests.has(requestId)) {
      const controller = this.pendingRequests.get(requestId);
      if (controller) {
        controller.abort();
        this.pendingRequests.delete(requestId);
      }
    }

    // 创建新的 AbortController
    const controller = new AbortController();
    const signal = controller.signal;

    // 将新的请求添加到 pendingRequests 中
    this.pendingRequests.set(requestId, controller);

    try {
      const response: AxiosResponse<ResponseData<T>> = await axios({
        ...config,
        signal,
      });

      // 请求成功后移除该请求
      this.pendingRequests.delete(requestId);

      return response.data;
    } catch (error: unknown) {
      const err = error as CustomAxiosError;

      // 如果请求被取消，则标记为已取消
      if (err.name === 'AbortError') {
        err.isCanceled = true;
      }

      // 请求失败后移除该请求
      this.pendingRequests.delete(requestId);

      throw err;
    }
  }

  // GET 请求封装
  public async get<T>(url: string, config?: RequestConfig): Promise<ResponseData<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  // POST 请求封装
  public async post<T>(url: string, data?: any, config?: RequestConfig): Promise<ResponseData<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  // PUT 请求封装
  public async put<T>(url: string, data?: any, config?: RequestConfig): Promise<ResponseData<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  // DELETE 请求封装
  public async delete<T>(url: string, config?: RequestConfig): Promise<ResponseData<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }
}

// 导出单例实例
const httpClient = new HttpClient();
export default httpClient;
