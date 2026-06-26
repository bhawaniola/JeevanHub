import React, { useState, useEffect } from 'react';
import './TalkOfTheTown.css';

const DoctorsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(3);

  // Mapped items per page based on viewport width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 625) {
        setItemsPerPage(1);
      } else if (window.innerWidth <= 850) {
        setItemsPerPage(2);
      } else {
        setItemsPerPage(3);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch doctors from backend on component mount
  useEffect(() => {
    fetch(`${process.env.REACT_APP_AYURVEDA_BACKEND_URL || 'http://localhost:8080'}/api/doctors/publicDoctors`)
      .then((response) => response.json())
      .then((data) => {
        const mappedDoctors = data.map((doctor) => ({
          name: `${doctor.firstName} ${doctor.lastName}`,
          specialization: doctor.designation || "N/A",
          experience: `${doctor.experience} years`,
          age: `${doctor.age || 'N/A'}`,
          thumbnail: doctor.thumbnail || '',
          price: doctor.price || 'N/A',
        }));
        setDoctors(mappedDoctors);
      })
      .catch((error) => {
        console.error("Error fetching doctors:", error);
      });
  }, []);

  const getDoctorImageUrl = (thumbnail) => {
    if (!thumbnail || thumbnail === 'null' || thumbnail === 'undefined') {
      return 'https://res.cloudinary.com/dmezmffej/image/upload/v1721891477/Frame_48097829.avif';
    }
    if (thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
      return thumbnail;
    }
    const backendUrl = process.env.REACT_APP_AYURVEDA_BACKEND_URL || 'http://localhost:8080';
    if (thumbnail.startsWith('/')) {
      return `${backendUrl}${thumbnail}`;
    }
    return `${backendUrl}/${thumbnail}`;
  };

  const handleLeftClick = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? Math.max(0, doctors.length - itemsPerPage) : prevIndex - 1));
  };

  const handleRightClick = () => {
    setCurrentIndex((prevIndex) => (prevIndex >= doctors.length - itemsPerPage ? 0 : prevIndex + 1));
  };

  return (
    <section className="talk-of-the-town">
      <div className="header1">
        <div className="title">Meet Our Doctors</div>
        <div className="gradient-border"></div>
      </div>

      <div className="slider-container">
        <div
          className="slick-slider1"
          style={{
            transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)`,
            transition: 'transform 0.3s ease',
            '--items-per-page': itemsPerPage
          }}
        >
          {doctors.map((doctor, index) => (
            <div className="slick-slide1" key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="video-card1" style={{ display: 'flex', flexDirection: 'column', height: 'auto', minHeight: '0', alignSelf: 'stretch' }}>
                <div className="video-thumbnail" style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={getDoctorImageUrl(doctor.thumbnail)}
                    alt={doctor.name}
                    className="thumbnail-img"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://res.cloudinary.com/dmezmffej/image/upload/v1721891477/Frame_48097829.avif';
                    }}
                  />
                </div>
                <div className="content" style={{ padding: '12px 15px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', flexGrow: 0, flexShrink: 1 }}>
                  <p className="influencer-name" style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: '600', color: '#333', textAlign: 'center' }}>{doctor.name}</p>
                  <p className="video-title" style={{ margin: '2px 0', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>{doctor.specialization}</p>
                  <div className="separator" style={{ height: '1px', backgroundColor: '#eee', margin: '8px auto', width: '80%' }}></div>
                  <p className="followers" style={{ margin: '2px 0', fontSize: '0.85rem', color: '#444', textAlign: 'center' }}>Experience: {doctor.experience}</p>
                  <p className="followers" style={{ margin: '2px 0', fontSize: '0.85rem', color: '#444', textAlign: 'center' }}>Doctors Age: {doctor.age}</p>
                  <p className="followers" style={{ margin: '2px 0', fontSize: '0.85rem', color: '#444', textAlign: 'center' }}>Price: {doctor.price}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {doctors.length > itemsPerPage && (
          <>
            <button className="arrow-button left" onClick={handleLeftClick}>←</button>
            <button className="arrow-button right" onClick={handleRightClick}>→</button>
          </>
        )}
      </div>
    </section>
  );
};

export default DoctorsSection;
