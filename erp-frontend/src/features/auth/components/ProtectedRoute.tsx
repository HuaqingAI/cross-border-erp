import { Spin } from 'antd'
import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { authApi } from '../../../api/auth'
import { useAuthStore } from '../../../stores/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated, setUser } = useAuthStore()
  const [loading, setLoading] = useState(!isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      authApi
        .getMe()
        .then((user) => {
          setUser(user)
        })
        .catch(() => {
          setUser(null)
        })
        .finally(() => {
          setLoading(false)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 200 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
