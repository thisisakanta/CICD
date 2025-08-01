import { API_BASE_URL } from "@/url";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { FaBell, FaCalendarCheck, FaInfoCircle, FaPills } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import notificationService from "../../services/NotificationService.js"; // Use lowercase
import "./NotificationCenter.css";

// Interface for notification data (matches backend Notification entity)
interface NotificationData {
  id: string; // UUID as string
  title: string;
  message: string;
  type:
    | "APPOINTMENT_CONFIRMATION"
    | "APPOINTMENT_REMINDER"
    | "APPOINTMENT_CANCELLATION"
    | "PRESCRIPTION_ISSUED"
    | "PRESCRIPTION_REFILL"
    | "MEDICINE_REMINDER"
    | "SYSTEM_ALERT";
  createdAt: string; // ISO 8601 string
  appointmentId?: number;
  prescriptionId?: number;
  reminderTime?: string;
  frequency?: string;
  isRead: boolean;
}

const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(0);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const effectiveUser = localStorage.getItem("currentUser")
    ? JSON.parse(localStorage.getItem("currentUser")!)
    : null;

  const userRole =
    localStorage.getItem("userRole") ||
    effectiveUser?.role?.toLowerCase() ||
    "patient";

  // Create portal container safely
  const getPortalContainer = () => {
    let container = document.getElementById("notification-portal");
    if (!container) {
      container = document.createElement("div");
      container.id = "notification-portal";
      document.body.appendChild(container);
    }
    return container;
  };

  // Load notifications function that accepts userId parameter
  const loadNotifications = async (userIdParam?: number) => {
    const currentUserId = userIdParam || userId;

    if (!currentUserId) {
      console.log("No user ID available");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load notifications");
      }

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      // Fallback mock data for testing
      const mockNotifications: NotificationData[] = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          type: "MEDICINE_REMINDER",
          title: "Medicine Reminder: Aspirin",
          message:
            "Time to take your medicine: Aspirin. Dosage: 1 tablet. Frequency: DAILY",
          isRead: false,
          createdAt: new Date().toISOString(),
          prescriptionId: 1,
          reminderTime: "08:00",
          frequency: "DAILY",
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174001",
          type: "APPOINTMENT_CONFIRMATION",
          title: "Appointment Confirmed",
          message:
            "Your appointment with Dr. Smith has been confirmed for tomorrow at 10:00 AM.",
          isRead: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          appointmentId: 1,
        },
      ];
      setNotifications(mockNotifications);
      setUnreadCount(2);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserAndSetupNotifications = async () => {
      try {
        const userResponse = await fetch(
          `${API_BASE_URL}/api/patients/profile`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (!userResponse.ok) {
          throw new Error("Failed to fetch user profile");
        }

        const response = await userResponse.json();

        // Set the userId state
        setUserId(response.id);

        if (response.id) {
          // Use response.id directly instead of waiting for state update
          await loadNotifications(response.id);

          // Connect to WebSocket
          try {
            notificationService.connect(
              Number(response.id),
              handleNewNotification
            );
          } catch (error) {
            console.warn(
              "WebSocket connection failed, will work without real-time updates:",
              error
            );
          }
        }
      } catch (error) {
        console.error("Failed to setup notifications:", error);
      }
    };

    fetchUserAndSetupNotifications();

    return () => {
      try {
        notificationService.disconnect();
      } catch (error) {
        console.warn("Error disconnecting WebSocket:", error);
      }
    };
  }, []);

  // Monitor userId state changes
  useEffect(() => {
    if (userId > 0) {
    }
  }, [userId]);

  const handleNewNotification = (notification: NotificationData) => {
    setNotifications((prev) => [notification, ...prev]);
    setUnreadCount((prev) => prev + (notification.isRead ? 0 : 1));
    notificationService.showBrowserNotification(notification);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to mark notification as read");
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      // Update UI locally as fallback
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const notificationToDelete = notifications.find(
        (n) => n.id === notificationId
      );
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to delete notification");
      }

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notificationToDelete && !notificationToDelete.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
      // Update UI locally as fallback
      const notificationToDelete = notifications.find(
        (n) => n.id === notificationId
      );
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notificationToDelete && !notificationToDelete.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/mark-all-read`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(
          data.error || "Failed to mark all notifications as read"
        );
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      // Update UI locally as fallback
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/clear-all`, // Fixed endpoint
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to clear notifications");
      }

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
      // Update UI locally as fallback
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const getNotificationIcon = (type: NotificationData["type"]) => {
    switch (type) {
      case "APPOINTMENT_CONFIRMATION":
      case "APPOINTMENT_REMINDER":
      case "APPOINTMENT_CANCELLATION":
        return <FaCalendarCheck className="notification-icon appointment" />;
      case "PRESCRIPTION_ISSUED":
      case "PRESCRIPTION_REFILL":
      case "MEDICINE_REMINDER":
        return <FaPills className="notification-icon prescription" />;
      case "SYSTEM_ALERT":
        return <FaInfoCircle className="notification-icon info" />;
      default:
        return <FaInfoCircle className="notification-icon info" />;
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleNotificationClick = async (notification: NotificationData) => {
    const basePath = userRole === "doctor" ? "/doctor" : "/patient";
    if (
      [
        "APPOINTMENT_CONFIRMATION",
        "APPOINTMENT_REMINDER",
        "APPOINTMENT_CANCELLATION",
      ].includes(notification.type)
    ) {
      await markAsRead(notification.id);
      if (notification.appointmentId) {
        setIsOpen(false);
        navigate(`${basePath}/appointments/${notification.appointmentId}`);
      }
    } else if (
      [
        "PRESCRIPTION_ISSUED",
        "PRESCRIPTION_REFILL",
        "MEDICINE_REMINDER",
      ].includes(notification.type)
    ) {
      await markAsRead(notification.id);
      if (notification.prescriptionId) {
        setIsOpen(false);
        navigate(`${basePath}/prescriptions/${notification.prescriptionId}`);
      }
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Request notification permission
  useEffect(() => {
    notificationService.requestNotificationPermission();
  }, []);

  // Don't render if no userId (but still allow component to mount)
  if (!userId) {
    return (
      <div className="notification-center">
        <button className="notification-bell" disabled>
          <FaBell />
        </button>
      </div>
    );
  }

  return (
    <div className="notification-center">
      <button
        className="notification-bell"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Notifications"
      >
        <FaBell />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen &&
        ReactDOM.createPortal(
          <div className="notification-dropdown" ref={dropdownRef}>
            <div className="notification-header">
              <h3>Notifications</h3>
              <div className="notification-actions">
                {notifications.length > 0 && unreadCount > 0 && (
                  <button
                    className="mark-all-read-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllAsRead();
                    }}
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    className="clear-all-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllNotifications();
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="notification-list">
              {isLoading ? (
                <div className="notification-loading">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="no-notifications">
                  <div className="empty-icon">🔔</div>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${
                      !notification.isRead ? "unread" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="notification-content">
                      <div className="notification-main">
                        {getNotificationIcon(notification.type)}
                        <div className="notification-text">
                          <p className="notification-title">
                            {notification.title}
                          </p>
                          <p className="notification-message">
                            {notification.message}
                          </p>
                          <span className="notification-time">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="notification-buttons">
                        {!notification.isRead && (
                          <button
                            className="mark-read-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            title="Mark as read"
                          >
                            ✓
                          </button>
                        )}
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          title="Delete notification"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          getPortalContainer() // Use safe portal container
        )}
    </div>
  );
};

export default NotificationCenter;
