package com.prescription.service;

import com.prescription.dto.*;
import com.prescription.entity.Doctor;
import com.prescription.entity.Patient;
import com.prescription.entity.User;
import com.prescription.repository.DoctorRepository;
import com.prescription.repository.PatientRepository;
import com.prescription.repository.UserRepository;
import com.prescription.util.JwtUtil;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@Transactional
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private DoctorRepository doctorRepository;

    public LoginResponse authenticate(LoginRequest loginRequest) {
        Optional<User> userOpt = userRepository.findByEmail(loginRequest.getEmail());

        if (userOpt.isEmpty()) {
            throw new RuntimeException("User not found with email: " + loginRequest.getEmail());
        }

        User user = userOpt.get();

        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid password");
        }

        // Update last login
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        // Generate JWT token
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().name(), user.getId());

        // Create user DTO
        UserDto userDto = convertToDto(user);

        return new LoginResponse(token, userDto);
    }

    public SignUpResponse register(@Valid SignUpRequest req) {

        // 1) uniqueness check
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new RuntimeException("Email already exists: " + req.getEmail());
        }

        // 2) map DTO → entity
        User user = User.builder()
                .name(req.getName())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .phone(req.getPhone())
                .role(req.getRole())
                .birthDate(req.getBirthDate())
                .gender(req.getGender())
                .isVerified(false)
                .build();

        // 3) save
        User saved = userRepository.save(user);

        // 4) create JWT (optional but handy for auto-login)
        String token = jwtUtil.generateToken(
                saved.getEmail(),
                saved.getRole().name(),
                saved.getId()
        );

        // 5) build response
        return SignUpResponse.builder()
                .id(saved.getId())
                .name(saved.getName())
                .email(saved.getEmail())
                .role(saved.getRole())
                .token(token)               // may be null if you skip auto-login
                .build();
    }

    public User createUser(User user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email already exists: " + user.getEmail());
        }

        // Encode password
        user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));

        return userRepository.save(user);
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public UserDto convertToDto(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setRole(user.getRole().name());
        dto.setBirthDate(user.getBirthDate());
        dto.setGender(user.getGender().name());
        return dto;
    }

    public UpdateUserResponse updateUser(User user, @Valid UpdateUserRequest req) {

        // 2) Update allowed fields
        user.setName(req.getName() != null ? req.getName() : user.getName());
        user.setPhone(req.getPhone() != null ? req.getPhone() : user.getPhone());
//        user.setBirthDate(req.getBirthDate() != null ? req.getBirthDate() : user.getBirthDate());
//        user.setGender(req.getGender() != null ? req.getGender() : user.getGender());
//        User.Gender gender = Objects.equals(req.getGender(), "MALE") ? User.Gender.MALE : (Objects.equals(req.getGender(), "FEMALE") ?User.Gender.FEMALE:User.Gender.OTHER);
//        user.setGender(gender);

        // 3) Save updated user
        User updated = userRepository.save(user);

        // 4) Generate new JWT (optional, only if email or role changes affect token)
        String token = null;
        if (req.getEmail() != null && !req.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(req.getEmail())) {
                throw new RuntimeException("Email already exists: " + req.getEmail());
            }
            user.setEmail(req.getEmail());
            token = jwtUtil.generateToken(
                    updated.getEmail(),
                    updated.getRole().name(),
                    updated.getId()
            );
        }

        // 5) Build response
        return UpdateUserResponse.builder()
                .id(updated.getId())
                .name(updated.getName())
                .email(updated.getEmail())
                .phone(updated.getPhone())
                .birthDate(updated.getBirthDate())
//                .gender(gender.toString())
                .role(updated.getRole().toString())
                .token(token) // may be null if no new token was generated
                .build();
    }



    @Autowired
    private PatientRepository patientRepository;

    // Add these methods to your UserService class
    public List<UserDto> getAllPatients() {
        // Get all users with PATIENT role
        List<User> patientUsers = userRepository.findAllPatients();
        
        // Convert to PatientResponse DTOs
        List<UserDto> responses = new ArrayList<>();
        for (User user : patientUsers) {
            responses.add(convertToDto(user));
        }
        return responses;
    }

    public PatientResponse getPatientById(Long id) {
        // Find patient by user ID
        Patient patient = patientRepository.findByUserId(id)
                .orElseThrow(() -> new RuntimeException("Patient not found with id: " + id));

        return mapToPatientResponse(patient);
    }

    public List<User> searchDoctors(String specialization,String name) {
        // If all parameters are null, return all available doctors
//        if (specialization == null && location == null && name == null) {
//            return userRepository.findByRoleAndAvailable("DOCTOR", true);
//        }
////
//        // Build dynamic query based on provided parameters
//        if (specialization != null && location != null && name != null) {
//            return userRepository.findByRoleAndSpecializationContainingIgnoreCaseAndLocationContainingIgnoreCaseAndNameContainingIgnoreCaseAndAvailable(
//                    "DOCTOR", specialization, location, name, true);
//        } else if (specialization != null && location != null) {
//            return userRepository.findByRoleAndSpecializationContainingIgnoreCaseAndLocationContainingIgnoreCaseAndAvailable(
//                    "DOCTOR", specialization, location, true);
//        } else if (specialization != null && name != null) {
//            return userRepository.findByRoleAndSpecializationContainingIgnoreCaseAndNameContainingIgnoreCaseAndAvailable(
//                    "DOCTOR", specialization, name, true);
//        } else if (location != null && name != null) {
//            return userRepository.findByRoleAndLocationContainingIgnoreCaseAndNameContainingIgnoreCaseAndAvailable(
//                    "DOCTOR", location, name, true);
//        } else if (specialization != null) {
//            return userRepository.findByRoleAndSpecializationContainingIgnoreCaseAndAvailable(
//                    "DOCTOR", specialization, true);
//        } else if (location != null) {
//            return userRepository.findByRoleAndLocationContainingIgnoreCaseAndAvailable(
//                    "DOCTOR", location, true);
//        } else if (name != null) {
//            return userRepository.findByRoleAndNameContainingIgnoreCaseAndAvailable(
//                    "DOCTOR", name, true);
//        }

        return userRepository.findAllDoctors();
    }

    private PatientResponse mapToPatientResponse(Patient patient) {
        User user = patient.getUser();

        return PatientResponse.builder()
                // User data
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .birthDate(user.getBirthDate())
                .gender(user.getGender())
                .profileImage(user.getProfileImage())
                .isVerified(user.getIsVerified())
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                // Patient-specific data
                .heightCm(patient.getHeightCm())
                .weightKg(patient.getWeightKg())
                .bloodType(patient.getBloodType())
                .patientCreatedAt(patient.getCreatedAt())
                .patientUpdatedAt(patient.getUpdatedAt())
                .build();
    }

    public List<UserDto> getAllDoctors() {
        List<User> doctorUsers = userRepository.findAllDoctors();

        // Convert to PatientResponse DTOs
        List<UserDto> responses = new ArrayList<>();
        for (User user : doctorUsers) {
            responses.add(convertToDto(user));
        }
        return responses;
    }

    public DoctorResponse getDoctorBYid(Long id)  {
        Doctor doctor= doctorRepository.findByUserId(id)
                .orElseThrow(() -> new RuntimeException("Doctor not found with id: " + id));

        return mapToDoctorResponse(doctor);
    }

    private DoctorResponse mapToDoctorResponse(Doctor doctor) {
        User user = doctor.getUser();

        return DoctorResponse.builder()
                // User data
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .birthDate(user.getBirthDate())
                .gender(user.getGender())
                .profileImage(user.getProfileImage())
                .isVerified(user.getIsVerified())
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                // Patient-specific data
                .institute(doctor.getInstitute())
                .licenseNumber(doctor.getLicenseNumber())
                .specialization(doctor.getSpecialization())
                .doctorCreatedAt(doctor.getCreatedAt())
                .doctorUpdatedAt(doctor.getUpdatedAt())
                .build();
    }

}