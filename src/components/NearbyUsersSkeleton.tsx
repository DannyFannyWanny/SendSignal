export default function NearbyUsersSkeleton() {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(8px)',
      borderRadius: '1.5rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      padding: '1.5rem',
      border: '1px solid rgba(229, 229, 229, 0.5)'
    }}>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Nearby Now</h2>
      
      <div className="space-y-3">
        {/* Skeleton items */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem',
            border: '1px solid rgba(229, 229, 229, 0.3)',
            padding: '0.75rem'
          }}>
            <div className="flex items-center space-x-3">
              {/* Skeleton activity dot */}
              <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%'
              }}></div>
              
              <div>
                {/* Skeleton name */}
                <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse mb-1"></div>
                {/* Skeleton distance */}
                <div className="w-16 h-3 bg-neutral-100 rounded animate-pulse"></div>
              </div>
            </div>
            
            {/* Skeleton button */}
            <div className="w-20 h-7 bg-neutral-200 rounded-lg animate-pulse"></div>
          </div>
        ))}
        
        {/* Empty state skeleton */}
        <div className="text-center py-6">
          <div className="w-32 h-4 bg-neutral-200 rounded animate-pulse mx-auto mb-2"></div>
          <div className="w-48 h-3 bg-neutral-100 rounded animate-pulse mx-auto"></div>
        </div>
      </div>
    </div>
  )
}
